const Stripe = require("stripe");

/* Stripe signs the webhook with the RAW request body, so Vercel's automatic
   JSON body-parsing must be OFF for this function or the signature check fails. */
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
      const session = event.data.object;
      /* Only act on a WasabiRub.com cart order that actually paid. Ignore
         SportPharm's WooCommerce orders and any unpaid/expired session. */
      const isWasabi = session.client_reference_id === "wasabirub" ||
        (session.metadata && session.metadata.source === "wasabirub.com");
      if (isWasabi && session.payment_status === "paid") {
        const items = await stripe.checkout.sessions.listLineItems(session.id, { limit: 50 });
        await sendOrderEmail(session, items.data);
      }
    }
    res.status(200).json({ received: true });
  } catch (err) {
    /* Return 500 so Stripe retries (with backoff, up to ~3 days) — better to
       retry than to silently lose an order notification. */
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

async function sendOrderEmail(session, lineItems) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY not set");

  const to = process.env.ORDER_TO_EMAIL || "orders@sportpharm.com";
  const from = process.env.ORDER_FROM_EMAIL || "WasabiRub Orders <orders@wasabirub.com>";

  const cust = session.customer_details || {};
  const ship = session.shipping_details || session.collected_information && session.collected_information.shipping_details || null;
  const shipName = (ship && ship.name) || cust.name || "";
  const shipAddr = fmtAddress(ship && ship.address) || fmtAddress(cust.address);

  const lines = (lineItems || []).map((li) => {
    const qty = li.quantity || 1;
    const name = li.description || (li.price && li.price.nickname) || "Item";
    return `  ${qty} x ${name} — ${money(li.amount_total, session.currency)}`;
  });

  const total = money(session.amount_total, session.currency);
  const orderNo = (session.metadata && session.metadata.order_number) || ("WR-" + session.id.slice(-8).toUpperCase());
  const sessionId = session.id;
  const when = new Date((session.created || Date.now() / 1000) * 1000).toLocaleString("en-US");

  const text =
`New WasabiRub.com order
Order ${orderNo} — ${total}

Items:
${lines.join("\n")}

Total paid: ${total}

Ship to:
${shipName}
${shipAddr}

Customer:
${cust.email || ""}
${cust.phone || ""}

Placed: ${when}
Order ${orderNo} · Stripe ${sessionId}
`;

  const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html =
`<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#18232e;line-height:1.6">
  <h2 style="margin:0 0 2px">New WasabiRub.com order</h2>
  <p style="margin:0 0 4px;font-size:13px;font-weight:bold;letter-spacing:.04em;color:#0f1d33">${esc(orderNo)}</p>
  <p style="margin:0 0 16px;font-size:20px;font-weight:bold;color:#d6202a">${esc(total)}</p>
  <table style="border-collapse:collapse;margin:0 0 16px">
    ${(lineItems || []).map((li) => `<tr>
      <td style="padding:4px 14px 4px 0">${esc(li.quantity || 1)} &times;</td>
      <td style="padding:4px 14px 4px 0">${esc(li.description || "Item")}</td>
      <td style="padding:4px 0;text-align:right">${esc(money(li.amount_total, session.currency))}</td>
    </tr>`).join("")}
  </table>
  <p style="margin:0 0 4px"><b>Ship to</b></p>
  <p style="margin:0 0 16px;white-space:pre-line">${esc(shipName)}\n${esc(shipAddr)}</p>
  <p style="margin:0 0 4px"><b>Customer</b></p>
  <p style="margin:0 0 16px">${esc(cust.email || "")}<br>${esc(cust.phone || "")}</p>
  <p style="margin:0;color:#66737d;font-size:12px">Order ${esc(orderNo)} &middot; Placed ${esc(when)} &middot; Stripe ${esc(sessionId)}</p>
</div>`;

  const body = {
    from: from,
    to: [to],
    subject: `New WasabiRub order ${orderNo} — ${total}${shipName ? " · " + shipName : ""}`,
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
