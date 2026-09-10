/* =============================================================================
   review-request — Supabase Edge Function

   Fires once per pharmacy check-in and emails the visitor a link to leave a
   Google review, via Resend.

   HOW IT IS CALLED
     A Database Webhook on `public.checkins` (AFTER INSERT) POSTs the new row
     here. See ../review-request.sql — it creates the trigger and sets the
     shared secret header the function checks below.

   WHAT IT WILL NOT DO
     • Email anyone who is not a pharmacy visit (grand-opening rows are
       ignored by the `event` prefix).
     • Email the same address twice inside REVIEW_COOLDOWN_DAYS, even if they
       check in every week. A regular gets asked once, not every visit.
     • Run without its secrets. Missing RESEND_API_KEY or REVIEW_URL is a
       loud 500, not a silent no-op.

   SECRETS (supabase secrets set --project-ref aihxmysugxnzxwvowqth KEY=value)
     RESEND_API_KEY        from resend.com → API Keys. Sending permission only.
     REVIEW_URL            the Google "write a review" link for the pharmacy
     FROM_EMAIL            e.g. "SportPharm <hello@wasabirub.com>" — the
                           domain must be verified in Resend first
     WEBHOOK_SECRET        random string; the same value goes in the trigger
     REPLY_TO              optional, e.g. the pharmacy inbox
     PHARMACY_ADDRESS      optional, printed in the footer
     REVIEW_COOLDOWN_DAYS  optional, default 90

   SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.
   The service-role key never leaves this function — it is what lets it read
   the table (anon cannot) to check for a recent send, and stamp the row.
============================================================================= */

const PHARMACY_PREFIX = 'Pharmacy Visit';

type Row = {
  id: string; email: string; full_name: string; event: string | null;
  created_at: string; review_email_sent_at?: string | null;
};

function env(name: string, fallback?: string): string {
  const v = Deno.env.get(name) ?? fallback;
  if (v === undefined || v === '') throw new Error(`Missing secret ${name}`);
  return v;
}

function firstName(full: string): string {
  const f = (full || '').trim().split(/\s+/)[0] || '';
  return f.length > 1 && f.length < 30 ? f : '';
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function emailHtml(name: string, reviewUrl: string, address: string): string {
  const hi = name ? `Hi ${escapeHtml(name)},` : 'Hi there,';
  return `<!doctype html><html><body style="margin:0;padding:0;background:#F2F3F5;font-family:Inter,Helvetica,Arial,sans-serif;color:#15202B">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F2F3F5;padding:32px 16px">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#fff;border-radius:14px;overflow:hidden">
  <tr><td style="background:#011430;padding:22px 28px;text-align:center">
    <div style="font-family:Impact,'Arial Narrow Bold',sans-serif;font-size:22px;letter-spacing:.02em;color:#fff;text-transform:uppercase">SportPharm</div>
  </td></tr>
  <tr><td style="padding:30px 28px 8px;font-size:17px;line-height:1.55">
    <p style="margin:0 0 14px">${hi}</p>
    <p style="margin:0 0 14px">Thanks for stopping by SportPharm today. We hope we took good care of you.</p>
    <p style="margin:0 0 22px">Would you take a minute to tell others how it went? A quick Google review helps more athletes and active people find us.</p>
    <p style="margin:0 0 26px;text-align:center">
      <a href="${escapeHtml(reviewUrl)}" style="display:inline-block;background:#D6202A;color:#fff;text-decoration:none;font-weight:700;font-size:16px;padding:14px 30px;border-radius:10px">Leave a Google review</a>
    </p>
    <p style="margin:0 0 14px;font-size:15px;color:#566371">It takes about a minute, and it means a lot to our team.</p>
    <p style="margin:0 0 6px;font-size:15px">Thank you,<br><strong>The SportPharm team</strong></p>
  </td></tr>
  <tr><td style="padding:18px 28px 26px;font-size:12px;line-height:1.5;color:#9AA4AF;border-top:1px solid #EEF0F2">
    You're receiving this one-time email because you checked in at SportPharm and shared your email with us.
    We don't sell your information. To make sure we never email you again, just reply to this message and say so.
    ${address ? `<br>${escapeHtml(address)}` : ''}
  </td></tr>
</table>
</td></tr></table></body></html>`;
}

function emailText(name: string, reviewUrl: string, address: string): string {
  return `${name ? `Hi ${name},` : 'Hi there,'}

Thanks for stopping by SportPharm today. We hope we took good care of you.

Would you take a minute to tell others how it went? A quick Google review helps more athletes and active people find us:

${reviewUrl}

Thank you,
The SportPharm team

--
You're receiving this one-time email because you checked in at SportPharm and shared your email with us. We don't sell your information. To make sure we never email you again, just reply to this message and say so.
${address}`.trim();
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('POST only', { status: 405 });

  // The trigger sends this header; nobody else knows the value.
  const secret = env('WEBHOOK_SECRET');
  if (req.headers.get('x-webhook-secret') !== secret) {
    return new Response('forbidden', { status: 403 });
  }

  let body: { type?: string; table?: string; record?: Row };
  try { body = await req.json(); } catch { return new Response('bad json', { status: 400 }); }
  const row = body.record;
  if (body.type !== 'INSERT' || body.table !== 'checkins' || !row?.id || !row.email) {
    return Response.json({ skipped: 'not a checkins insert' });
  }
  if (!(row.event || '').startsWith(PHARMACY_PREFIX)) {
    return Response.json({ skipped: 'not a pharmacy visit' });
  }
  if (row.review_email_sent_at) {
    return Response.json({ skipped: 'already sent for this row' });
  }

  const supabaseUrl = env('SUPABASE_URL');
  const serviceKey  = env('SUPABASE_SERVICE_ROLE_KEY');
  const rest = `${supabaseUrl}/rest/v1/checkins`;
  const svc = {
    'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}`,
    'Content-Type': 'application/json', 'Prefer': 'return=minimal',
  };

  // Cooldown: has this address been asked recently, on any row?
  const days = Number(env('REVIEW_COOLDOWN_DAYS', '90')) || 90;
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const email = row.email.trim().toLowerCase();
  const recent = await fetch(
    `${rest}?select=id&email=ilike.${encodeURIComponent(email)}&review_email_sent_at=gte.${since}&limit=1`,
    { headers: svc },
  );
  if (!recent.ok) return new Response(`lookup failed ${recent.status}`, { status: 502 });
  if ((await recent.json()).length) {
    // Stamp it anyway so the row is not re-examined, but mark why.
    await fetch(`${rest}?id=eq.${row.id}`, { method: 'PATCH', headers: svc,
      body: JSON.stringify({ review_email_sent_at: new Date().toISOString(), review_email_status: 'skipped-cooldown' }) });
    return Response.json({ skipped: `asked within ${days} days` });
  }

  // Claim the row BEFORE sending, so a webhook retry cannot double-send.
  const claim = await fetch(
    `${rest}?id=eq.${row.id}&review_email_sent_at=is.null`,
    { method: 'PATCH', headers: { ...svc, 'Prefer': 'return=representation' },
      body: JSON.stringify({ review_email_sent_at: new Date().toISOString(), review_email_status: 'sending' }) },
  );
  if (!claim.ok) return new Response(`claim failed ${claim.status}`, { status: 502 });
  if (!(await claim.json()).length) return Response.json({ skipped: 'claimed by another run' });

  const reviewUrl = env('REVIEW_URL');
  const from      = env('FROM_EMAIL');
  const address   = Deno.env.get('PHARMACY_ADDRESS') ?? '';
  const replyTo   = Deno.env.get('REPLY_TO') ?? '';
  const name      = firstName(row.full_name);

  const send = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from, to: [row.email], ...(replyTo ? { reply_to: replyTo } : {}),
      subject: 'How did we do at SportPharm?',
      html: emailHtml(name, reviewUrl, address),
      text: emailText(name, reviewUrl, address),
      tags: [{ name: 'kind', value: 'review-request' }, { name: 'checkin', value: row.id }],
    }),
  });

  const result = await send.text();
  const status = send.ok ? 'sent' : `failed-${send.status}`;
  await fetch(`${rest}?id=eq.${row.id}`, { method: 'PATCH', headers: svc,
    body: JSON.stringify({ review_email_status: status, ...(send.ok ? {} : { review_email_sent_at: null }) }) });

  if (!send.ok) {
    console.error('resend failed', send.status, result);
    return new Response(`resend ${send.status}: ${result}`, { status: 502 });
  }
  return Response.json({ sent: true, resend: JSON.parse(result) });
});
