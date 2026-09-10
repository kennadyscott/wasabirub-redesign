-- =============================================================================
-- The email-updates checkbox on the pharmacy kiosk.
-- Run once in the Supabase SQL editor (or via the management API).
--
-- NULL on a row means the question was never asked (grand-opening rows, and
-- pharmacy rows from before the box existed). TRUE/FALSE is the visitor's
-- answer. The box is ticked by default, so most rows will be TRUE — but a
-- FALSE is a real "no" and must be honoured on any marketing send.
-- =============================================================================
alter table public.checkins
  add column if not exists email_opt_in boolean;

comment on column public.checkins.email_opt_in is
  'Pharmacy kiosk: left the "email me updates" box ticked. NULL = not asked.';
