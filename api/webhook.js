const Stripe = require("stripe");

/* Stripe signs the webhook with the RAW request body, so Vercel's automatic
   JSON body-parsing must be OFF for this function (see config at the bottom). */
async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !whSecret) {
    console.error("webhook: missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET");
    res.status(500).json({ error: "Webhook is not configured yet." });
    return;
  }

  const stripe = new Stripe(secret);

  let event;
  try {
    const raw = await readRawBody(req);
    event = stripe.webhooks.constructEvent(raw, req.headers["stripe-signature"], whSecret);
  } catch (err) {
    console.error("webhook: signature verification failed —", err.message);
    res.status(400).send("Webhook signature verification failed.");
    return;
  }

  try {
    if (event.type === "checkout.session.completed") {
      const s = event.data.object;
      const isWasabi = s.client_reference_id === "wasabirub" ||
        (s.metadata && s.metadata.source === "wasabirub.com");
      if (isWasabi && s.payment_status === "paid") {
        const full = await stripe.checkout.sessions.retrieve(s.id, {
          expand: ["line_items", "discounts.promotion_code"],
        });
        /* Team notification is critical — a failure here should retry. */
        await sendOrderEmail(full);
        /* Customer confirmation is best-effort — never let it fail the webhook
           (that would re-send the team notification on Stripe's retry). */
        try {
          await sendCustomerConfirmation(full);
        } catch (e) {
          console.error("webhook: customer confirmation failed —", e.message);
        }
      }
    }
    res.status(200).json({ received: true });
  } catch (err) {
    console.error("webhook: handling failed —", err.message);
    res.status(500).json({ error: "Handler failed." });
  }
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(typeof c === "string" ? Buffer.from(c) : c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function money(cents, currency) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: (currency || "usd").toUpperCase() })
    .format((cents || 0) / 100);
}
function fmtAddress(a) {
  if (!a) return "";
  return [a.line1, a.line2, [a.city, a.state, a.postal_code].filter(Boolean).join(", "), a.country]
    .filter(Boolean).join("\n");
}
function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* Everything both emails need, computed once. */
function orderView(session) {
  const cur = session.currency;
  const cust = session.customer_details || {};
  const ship = session.shipping_details ||
    (session.collected_information && session.collected_information.shipping_details) || null;
  const shipName = (ship && ship.name) || cust.name || "";
  const shipAddr = fmtAddress(ship && ship.address) || fmtAddress(cust.address);
  const items = (session.line_items && session.line_items.data) || [];
  const td = session.total_details || {};
  const discount = td.amount_discount || 0, shipping = td.amount_shipping || 0, tax = td.amount_tax || 0;
  const subtotal = session.amount_subtotal || 0, total = session.amount_total || 0;

  let promo = "";
  const disc = (session.discounts && session.discounts[0]) || null;
  if (disc) {
    if (disc.promotion_code && typeof disc.promotion_code === "object") promo = disc.promotion_code.code;
    else if (disc.coupon && disc.coupon.name) promo = disc.coupon.name;
  }
  const orderNo = (session.metadata && session.metadata.order_number) ||
    ("WR-" + session.id.slice(-8).toUpperCase());
  const when = new Date((session.created || Date.now() / 1000) * 1000).toLocaleString("en-US");

  const linesText = items.map((li) =>
    `  ${li.quantity} x ${li.description || "Item"}  —  ${money(li.amount_subtotal, cur)}`).join("\n");
  const sumText = [`  Subtotal:  ${money(subtotal, cur)}`];
  if (discount > 0) sumText.push(`  Discount${promo ? " (" + promo + ")" : ""}:  -${money(discount, cur)}`);
  sumText.push(`  Shipping:  ${shipping > 0 ? money(shipping, cur) : "Free"}`);
  if (tax > 0) sumText.push(`  Tax:  ${money(tax, cur)}`);
  sumText.push(`  TOTAL:  ${money(total, cur)}`);

  const itemRows = items.map((li) => `<tr>
      <td style="padding:6px 14px 6px 0;vertical-align:top">${esc(li.quantity)} &times;</td>
      <td style="padding:6px 14px 6px 0">${esc(li.description || "Item")}</td>
      <td style="padding:6px 0;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums">${esc(money(li.amount_subtotal, cur))}</td>
    </tr>`).join("");
  const sumRow = (label, val, o) => `<tr>
      <td colspan="2" style="padding:3px 14px 3px 0;text-align:right;${o && o.bold ? "font-weight:bold;border-top:1px solid #e6e9ec;padding-top:8px" : "color:#4b5560"}">${label}</td>
      <td style="padding:3px 0;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;${o && o.bold ? "font-weight:bold;border-top:1px solid #e6e9ec;padding-top:8px" : ""}${o && o.green ? "color:#167545" : ""}">${val}</td>
    </tr>`;
  let summaryHtml = sumRow("Subtotal", esc(money(subtotal, cur)));
  if (discount > 0) summaryHtml += sumRow("Discount" + (promo ? " (" + esc(promo) + ")" : ""), "&minus;" + esc(money(discount, cur)), { green: true });
  summaryHtml += sumRow("Shipping", shipping > 0 ? esc(money(shipping, cur)) : "Free");
  if (tax > 0) summaryHtml += sumRow("Tax", esc(money(tax, cur)));
  summaryHtml += sumRow("Total", esc(money(total, cur)), { bold: true });

  return { cur, cust, shipName, shipAddr, orderNo, when, total, linesText, sumText, itemRows, summaryHtml };
}

async function resendSend(body) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY not set");
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text().catch(() => "")}`);
}

/* Internal notification -> orders@sportpharm.com */
async function sendOrderEmail(session) {
  const v = orderView(session);
  const to = process.env.ORDER_TO_EMAIL || "orders@sportpharm.com";
  const from = process.env.ORDER_FROM_EMAIL || "WasabiRub Orders <orders@wasabirub.com>";
  const text =
`New WasabiRub.com order
Order ${v.orderNo}

Items:
${v.linesText}

${v.sumText.join("\n")}

Ship to:
${v.shipName}
${v.shipAddr}

Customer:
${v.cust.email || ""}
${v.cust.phone || ""}

Placed: ${v.when}
Order ${v.orderNo} · Stripe ${session.id}
`;
  const html =
`<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#18232e;line-height:1.6;max-width:520px">
  <h2 style="margin:0 0 2px;font-size:22px">New WasabiRub.com order</h2>
  <p style="margin:0 0 18px;font-size:13px;font-weight:bold;letter-spacing:.06em;color:#0f1d33">${esc(v.orderNo)}</p>
  <table style="border-collapse:collapse;width:100%;margin:0 0 6px">${v.itemRows}${v.summaryHtml}</table>
  <p style="margin:20px 0 4px"><b>Ship to</b></p>
  <p style="margin:0 0 16px;white-space:pre-line">${esc(v.shipName)}\n${esc(v.shipAddr)}</p>
  <p style="margin:0 0 4px"><b>Customer</b></p>
  <p style="margin:0 0 18px">${esc(v.cust.email || "")}${v.cust.phone ? "<br>" + esc(v.cust.phone) : ""}</p>
  <p style="margin:0;color:#66737d;font-size:12px;border-top:1px solid #e6e9ec;padding-top:12px">Order ${esc(v.orderNo)} &middot; Placed ${esc(v.when)} &middot; Stripe ${esc(session.id)}</p>
</div>`;
  const body = { from, to: [to], subject: `New WasabiRub order ${v.orderNo} — ${money(v.total, v.cur)}${v.shipName ? " · " + v.shipName : ""}`, text, html };
  if (v.cust.email) body.reply_to = v.cust.email;
  await resendSend(body);
}

/* Branded confirmation -> the customer */
async function sendCustomerConfirmation(session) {
  const v = orderView(session);
  if (!v.cust.email) return; // nothing to send to
  const from = process.env.CUSTOMER_FROM_EMAIL || "WasabiRub <orders@wasabirub.com>";
  const replyTo = process.env.ORDER_TO_EMAIL || "orders@sportpharm.com";
  const firstName = (v.shipName || "").trim().split(" ")[0] || "there";
  const text =
`Thanks for your order, ${firstName}!

We've received your WasabiRub order and it's being prepared. We'll email you tracking as soon as it ships.

Order ${v.orderNo}

Items:
${v.linesText}

${v.sumText.join("\n")}

Ship to:
${v.shipName}
${v.shipAddr}

Questions? Just reply to this email.

— WasabiRub, by SportPharm
For external use only. Use only as directed.
`;
  const html =
`<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#18232e;line-height:1.6;max-width:520px">
  <div style="background:#0f1d33;color:#fff;padding:22px 24px;border-radius:12px 12px 0 0">
    <p style="margin:0 0 4px;font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#ff6a6f">Order confirmed</p>
    <h2 style="margin:0;font-size:24px;font-weight:900;letter-spacing:-.02em">Thanks for your order, ${esc(firstName)}!</h2>
  </div>
  <div style="border:1px solid #e6e9ec;border-top:0;border-radius:0 0 12px 12px;padding:22px 24px">
    <p style="margin:0 0 16px;color:#4b5560">We&rsquo;re preparing your order now &mdash; we&rsquo;ll email you tracking as soon as it ships.</p>
    <p style="margin:0 0 12px;font-size:13px;font-weight:bold;letter-spacing:.06em;color:#0f1d33">Order ${esc(v.orderNo)}</p>
    <table style="border-collapse:collapse;width:100%;margin:0 0 6px">${v.itemRows}${v.summaryHtml}</table>
    <p style="margin:20px 0 4px"><b>Shipping to</b></p>
    <p style="margin:0 0 18px;white-space:pre-line;color:#4b5560">${esc(v.shipName)}\n${esc(v.shipAddr)}</p>
    <p style="margin:0 0 4px;color:#4b5560">Questions? Just reply to this email and our team will help.</p>
    <p style="margin:14px 0 0;color:#8a938f;font-size:12px;border-top:1px solid #e6e9ec;padding-top:12px">WasabiRub, by SportPharm &middot; For external use only. Use only as directed.</p>
  </div>
</div>`;
  await resendSend({ from, to: [v.cust.email], reply_to: replyTo, subject: `Your WasabiRub order is confirmed — ${v.orderNo}`, text, html });
}

module.exports = handler;
/* Vercel: do not parse the body — Stripe needs the raw bytes for the signature. */
module.exports.config = { api: { bodyParser: false } };
