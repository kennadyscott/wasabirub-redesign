/* TEMPORARY diagnostic — gated by a token; removed after debugging.
   Reports env presence and attempts the exact order-email send. */
module.exports = async function handler(req, res) {
  const TOKEN = "dbg-9f3a1c72";
  let k = req.query && req.query.k;
  if (!k) { try { k = new URL(req.url, "http://x").searchParams.get("k"); } catch (e) {} }
  if (k !== TOKEN) { res.status(404).end(); return; }

  const key = process.env.RESEND_API_KEY;
  const from = process.env.ORDER_FROM_EMAIL || "WasabiRub Orders <orders@wasabirub.com>";
  const to = process.env.ORDER_TO_EMAIL || "orders@sportpharm.com";
  const out = {
    env: {
      RESEND_API_KEY: !!key,
      STRIPE_SECRET_KEY: !!process.env.STRIPE_SECRET_KEY,
      STRIPE_WEBHOOK_SECRET: !!process.env.STRIPE_WEBHOOK_SECRET,
    },
    from: from, to: to,
  };
  try {
    const a = await fetch("https://api.resend.com/audiences", { headers: { Authorization: `Bearer ${key}` } });
    out.audiencesStatus = a.status;
  } catch (e) { out.audiencesErr = String(e.message); }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: from, to: [to], subject: "WasabiRub diagnostic send", text: "Diagnostic — confirms order emails can send. Safe to ignore." }),
    });
    out.sendStatus = r.status;
    out.sendBody = (await r.text()).slice(0, 400);
  } catch (e) { out.sendErr = String(e.message); }
  res.status(200).json(out);
};
