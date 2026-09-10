-- =============================================================================
-- review-request — wiring for the automatic Google-review email
-- Run ONCE in the Supabase SQL editor for project sportpharm-opening
-- (aihxmysugxnzxwvowqth), AFTER the edge function is deployed and its
-- secrets are set. Replace the two placeholders first.
-- =============================================================================

-- 1. Two bookkeeping columns. The function claims a row by stamping
--    review_email_sent_at before it sends, which is what stops a webhook
--    retry from emailing twice. Nullable, so the grand-opening rows and the
--    kiosk's plain INSERT are untouched.
alter table public.checkins
  add column if not exists review_email_sent_at timestamptz,
  add column if not exists review_email_status  text;

create index if not exists checkins_review_sent_idx
  on public.checkins (lower(email), review_email_sent_at);

-- anon may still only INSERT, and may still only UPDATE a row whose prize is
-- blank. The new columns are written ONLY by the function's service role,
-- never by the kiosk, so no policy changes. Do not add any.

-- 2. The webhook. pg_net is what Supabase's own "Database Webhooks" UI uses;
--    this is the same trigger written out so it lives in the repo.
create extension if not exists pg_net with schema extensions;

drop trigger if exists review_request_on_checkin on public.checkins;
drop function if exists public.review_request_webhook();

create function public.review_request_webhook()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  -- Only pharmacy rows leave the database. Grand-opening rows never even
  -- make the HTTP call.
  if new.event like 'Pharmacy Visit%' then
    perform net.http_post(
      url     := 'https://aihxmysugxnzxwvowqth.supabase.co/functions/v1/review-request',
      headers := jsonb_build_object(
        'Content-Type',     'application/json',
        'x-webhook-secret', '__WEBHOOK_SECRET__'   -- same value as the WEBHOOK_SECRET secret
      ),
      body    := jsonb_build_object(
        'type',   'INSERT',
        'table',  TG_TABLE_NAME,
        'schema', TG_TABLE_SCHEMA,
        'record', to_jsonb(new)
      ),
      timeout_milliseconds := 8000
    );
  end if;
  return new;
end;
$$;

create trigger review_request_on_checkin
  after insert on public.checkins
  for each row
  execute function public.review_request_webhook();

-- 3. Check it took:
--   select tgname from pg_trigger where tgrelid = 'public.checkins'::regclass;
-- Then check in on the kiosk with your own email and watch for the message.
-- Failed sends leave review_email_status = 'failed-<code>' on the row and the
-- reason in the function's logs (Edge Functions → review-request → Logs).
