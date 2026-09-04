/* Popup email capture -> Resend Audience.
   Env: RESEND_API_KEY, RESEND_AUDIENCE_ID. CORS handled in vercel.json. */
function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch (e) { return {}; } }
  return req.body;
}

/* Which Resend audience to file signups into. Use RESEND_AUDIENCE_ID if set;
   otherwise look it up automatically — prefer one named like WasabiRub, else
   the only/first audience on the account. No manual ID hunting required. */
let _cachedAudienceId = null;
async function resolveAudienceId(key) {
  if (process.env.RESEND_AUDIENCE_ID) return process.env.RESEND_AUDIENCE_ID;
  if (_cachedAudienceId) return _cachedAudienceId;
  const r = await fetch("https://api.resend.com/audiences", {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!r.ok) throw new Error("list audiences " + r.status);
  const j = await r.json();
  const list = (j && j.data) || [];
  if (!list.length) throw new Error("no audiences on this Resend account");
  const pick = list.find((a) => /wasabi/i.test(a.name || "")) || list[0];
  _cachedAudienceId = pick.id;
  return _cachedAudienceId;
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error("subscribe: missing RESEND_API_KEY");
    res.status(500).json({ error: "Signup is not configured yet." });
    return;
  }

  const body = parseBody(req);
  const email = String(body.email || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    res.status(400).json({ error: "Please enter a valid email." });
    return;
  }

  try {
    const audienceId = await resolveAudienceId(key);
    const r = await fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, unsubscribed: false }),
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      /* An already-subscribed email is a success from the visitor's side. */
      if (r.status === 409 || /already|exists/i.test(detail)) {
        res.status(200).json({ ok: true, already: true });
        return;
      }
      console.error("subscribe: resend", r.status, detail);
      res.status(502).json({ error: "Could not sign you up. Please try again." });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("subscribe:", err.message);
    res.status(500).json({ error: "Could not sign you up. Please try again." });
  }
};
