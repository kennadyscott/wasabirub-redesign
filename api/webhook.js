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
        /* Pull the full session so we have line items, discount + promo code. */
        const full = await stripe.checkout.sessions.retrieve(s.id, {
          expand: ["line_items", "discounts.promotion_code"],
        });
        await sendOrderEmail(full);
      }
    }
    res.status(200).json({ received: true });
  } catch (err) {
    /* 500 -> Stripe retries (backoff, ~3 days). Better than losing an order. */
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

async function sendOrderEmail(session) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY not set");
  const to = process.env.ORDER_TO_EMAIL || "orders@sportpharm.com";
  const from = process.env.ORDER_FROM_EMAIL || "WasabiRub Orders <orders@wasabirub.com>";

  const cur = session.currency;
  const cust = session.customer_details || {};
  const ship = session.shipping_details ||
    (session.collected_information && session.collected_information.shipping_details) || null;
  const shipName = (ship && ship.name) || cust.name || "";
  const shipAddr = fmtAddress(ship && ship.address) || fmtAddress(cust.address);

  const items = (session.line_items && session.line_items.data) || [];
  const td = session.total_details || {};
  const discount = td.amount_discount || 0;
  const shipping = td.amount_shipping || 0;
  const tax = td.amount_tax || 0;
  const subtotal = session.amount_subtotal || 0;
  const total = session.amount_total || 0;

  /* promo code used, if any */
  let promo = "";
  const disc = (session.discounts && session.discounts[0]) || null;
  if (disc) {
    if (disc.promotion_code && typeof disc.promotion_code === "object") promo = disc.promotion_code.code;
    else if (disc.coupon && disc.coupon.name) promo = disc.coupon.name;
  }

  const orderNo = (session.metadata && session.metadata.order_number) ||
    ("WR-" + session.id.slice(-8).toUpperCase());
  const when = new Date((session.created || Date.now() / 1000) * 1000).toLocaleString("en-US");

  /* ---- plain-text ---- */
  const lines = items.map((li) =>
    `  ${li.quantity} x ${li.description || "Item"}  —  ${money(li.amount_subtotal, cur)}`);
  const sumRows = [`  Subtotal:  ${money(subtotal, cur)}`];
  if (discount > 0) sumRows.push(`  Discount${promo ? " (" + promo + ")" : ""}:  -${money(discount, cur)}`);
  sumRows.push(`  Shipping:  ${shipping > 0 ? money(shipping, cur) : "Free"}`);
  if (tax > 0) sumRows.push(`  Tax:  ${money(tax, cur)}`);
  sumRows.push(`  TOTAL:  ${money(total, cur)}`);

  const text =
`New WasabiRub.com order
Order ${orderNo}

Items:
${lines.join("\n")}

${sumRows.join("\n")}

Ship to:
${shipName}
${shipAddr}

Customer:
${cust.email || ""}
${cust.phone || ""}

Placed: ${when}
Order ${orderNo} · Stripe ${session.id}
`;

  /* ---- HTML ---- */
  const itemRows = items.map((li) => `<tr>
      <td style="padding:6px 14px 6px 0;vertical-align:top">${esc(li.quantity)} &times;</td>
      <td style="padding:6px 14px 6px 0">${esc(li.description || "Item")}</td>
      <td style="padding:6px 0;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums">${esc(money(li.amount_subtotal, cur))}</td>
    </tr>`).join("");

  const sumRow = (label, val, opts) => `<tr>
      <td colspan="2" style="padding:3px 14px 3px 0;text-align:right;${opts && opts.bold ? "font-weight:bold;border-top:1px solid #e6e9ec;padding-top:8px" : "color:#4b5560"}">${label}</td>
      <td style="padding:3px 0;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;${opts && opts.bold ? "font-weight:bold;border-top:1px solid #e6e9ec;padding-top:8px" : ""}${opts && opts.red ? "color:#167545" : ""}">${val}</td>
    </tr>`;

  let summaryHtml = sumRow("Subtotal", esc(money(subtotal, cur)));
  if (discount > 0) summaryHtml += sumRow("Discount" + (promo ? " (" + esc(promo) + ")" : ""), "&minus;" + esc(money(discount, cur)), { red: true });
  summaryHtml += sumRow("Shipping", shipping > 0 ? esc(money(shipping, cur)) : "Free");
  if (tax > 0) summaryHtml += sumRow("Tax", esc(money(tax, cur)));
  summaryHtml += sumRow("Total", esc(money(total, cur)), { bold: true });

  const html =
`<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#18232e;line-height:1.6;max-width:520px">
  <h2 style="margin:0 0 2px;font-size:22px">New WasabiRub.com order</h2>
  <p style="margin:0 0 18px;font-size:13px;font-weight:bold;letter-spacing:.06em;color:#0f1d33">${esc(orderNo)}</p>
  <table style="border-collapse:collapse;width:100%;margin:0 0 6px">
    ${itemRows}
    ${summaryHtml}
  </table>
  <p style="margin:20px 0 4px"><b>Ship to</b></p>
  <p style="margin:0 0 16px;white-space:pre-line">${esc(shipName)}\n${esc(shipAddr)}</p>
  <p style="margin:0 0 4px"><b>Customer</b></p>
  <p style="margin:0 0 18px">${esc(cust.email || "")}${cust.phone ? "<br>" + esc(cust.phone) : ""}</p>
  <p style="margin:0;color:#66737d;font-size:12px;border-top:1px solid #e6e9ec;padding-top:12px">Order ${esc(orderNo)} &middot; Placed ${esc(when)} &middot; Stripe ${esc(session.id)}</p>
</div>`;

  const body = {
    from: from,
    to: [to],
    subject: `New WasabiRub order ${orderNo} — ${money(total, cur)}${shipName ? " · " + shipName : ""}`,
    text: text,
    html: html,
  };
  if (cust.email) body.reply_to = cust.email;

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    throw new Error(`Resend ${r.status}: ${detail}`);
  }
}

module.exports = handler;
/* Vercel: do not parse the body — Stripe needs the raw bytes for the signature. */
module.exports.config = { api: { bodyParser: false } };
