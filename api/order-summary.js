/* Read-only order summary for the confirmation page. Given a Checkout Session
   id (which the buyer already holds in their URL), returns the order number,
   line items and totals — no address, no phone. */
const Stripe = require("stripe");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const secret = process.env.STRIPE_SECRET_KEY;
  let id = req.query && req.query.session_id;
  if (!id) { try { id = new URL(req.url, "http://x").searchParams.get("session_id"); } catch (e) {} }
  if (!secret || !id || !/^cs_[A-Za-z0-9_]+$/.test(id)) {
    res.status(400).json({ error: "Missing or invalid session." });
    return;
  }
  try {
    const stripe = new Stripe(secret);
    const s = await stripe.checkout.sessions.retrieve(id, { expand: ["line_items"] });
    const isWasabi = s.client_reference_id === "wasabirub" ||
      (s.metadata && s.metadata.source === "wasabirub.com");
    if (!isWasabi) { res.status(404).json({ error: "Not found." }); return; }
    const items = (s.line_items && s.line_items.data ? s.line_items.data : []).map((li) => ({
      name: li.description || "Item",
      qty: li.quantity || 1,
      amount: li.amount_subtotal || 0,
    }));
    const td = s.total_details || {};
    res.status(200).json({
      order_number: (s.metadata && s.metadata.order_number) || null,
      currency: s.currency || "usd",
      items: items,
      subtotal: s.amount_subtotal || 0,
      discount: td.amount_discount || 0,
      shipping: td.amount_shipping || 0,
      total: s.amount_total || 0,
      paid: s.payment_status === "paid",
    });
  } catch (e) {
    res.status(500).json({ error: "Could not load your order." });
  }
};
