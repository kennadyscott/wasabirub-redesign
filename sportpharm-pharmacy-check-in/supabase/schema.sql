-- =============================================================================
-- SportPharm Grand Opening — check-in table
-- Run this once in the Supabase SQL editor, then paste the project URL and the
-- ANON key into js/config.js.
--
-- THE SECURITY MODEL, IN ONE LINE:
--   anon may INSERT, and may UPDATE a row only until its prize is filled in.
--
-- That is what makes it safe to ship the anon key inside a public web page.
-- The kiosk only ever needs to write. Reading the guest list is a staff job
-- and happens either in the Supabase dashboard (you are logged in there) or
-- from the CSV on the iPad. If you ever add a SELECT policy for anon, the
-- anon key in js/config.js becomes a public download link for every guest's
-- name, email and home address. Don't.
-- =============================================================================

create table if not exists public.checkins (
  -- Generated on the iPad so a retry after a flaky-wifi timeout can't insert
  -- the same guest twice. A retry hits this primary key and comes back 409,
  -- which the kiosk reads as "already landed" and marks synced.
  id           uuid primary key,

  raffle       text not null,
  -- When the guest actually tapped the button, per the iPad's clock.
  created_at   timestamptz not null,
  -- When it reached us. Server-set, so it is the one that can't be spoofed
  -- and the one to trust if an iPad's clock is wrong.
  received_at  timestamptz not null default now(),

  device       text,
  event        text,

  full_name    text not null,
  company      text,
  email        text not null,
  phone        text,
  street       text,
  city         text,
  state        text,
  zip          text,
  role         text,

  -- Filled in a moment after the row is first inserted, when the wheel stops.
  -- The kiosk PATCHes them onto the row afterwards.
  prize        text,
  prize_label  text,

  -- Bound every field. anon can insert, so these constraints are the only
  -- thing standing between you and someone posting a megabyte of junk.
  constraint checkins_len check (
    length(full_name) between 2 and 120 and
    coalesce(length(company), 0) <= 160 and
    length(email)     between 5 and 254 and
    coalesce(length(phone),  0) <= 20  and
    coalesce(length(street), 0) <= 200 and
    coalesce(length(city),   0) <= 100 and
    coalesce(length(state),  0) <= 2   and
    coalesce(length(zip),    0) <= 10  and
    coalesce(length(role),   0) <= 60  and
    coalesce(length(prize),  0) <= 40  and
    coalesce(length(prize_label), 0) <= 80 and
    coalesce(length(raffle), 0) <= 12
  ),
  constraint checkins_email check (email ~* '^[^@\s]+@[^@\s]+\.[a-z]{2,}$')
);

create index if not exists checkins_received_idx on public.checkins (received_at desc);
create index if not exists checkins_email_idx    on public.checkins (lower(email));

alter table public.checkins enable row level security;

-- The one and only anon grant: write, never read.
drop policy if exists "kiosk may insert" on public.checkins;
create policy "kiosk may insert"
  on public.checkins for insert
  to anon
  with check (true);

-- anon must also be able to UPDATE, or the prize can never be attached: the
-- row is inserted when the guest submits, and the wheel stops a few seconds
-- later.
--
-- But an unrestricted UPDATE would let anyone holding the public anon key
-- overwrite every row in the table. They still could not READ it, so nothing
-- leaks — but they could vandalise the whole guest list. So the grant is
-- narrowed to what the kiosk actually needs: a row may be written to only
-- while its prize is still blank. Once the prize lands, the row is frozen.
--
-- The kiosk inserts with prize = '' and PATCHes it in on the next sync, so
-- this matches the real flow, and a retry of that same PATCH is still allowed
-- because the stored prize is still blank until one succeeds.
--
-- ⚠️ DO NOT change the kiosk back to an upsert (on_conflict + merge-duplicates)
-- to save a round trip. Tested against this very project: PostgreSQL's
-- INSERT ... ON CONFLICT DO UPDATE also requires a SELECT policy under RLS, so
-- the upsert fails with 42501 — and the only way to satisfy it is to make the
-- guest list publicly readable, which is precisely what must never happen.
-- Plain INSERT + PATCH is the way round it, and it needs no SELECT policy.
--
-- If this policy is ever wrong, the failure is loud but harmless: prizes stop
-- reaching the cloud and the staff screen shows rows stuck on "waiting to
-- sync". The check-in itself still lands, and the CSV on the iPad still has
-- everything.
drop policy if exists "kiosk may attach a prize" on public.checkins;
create policy "kiosk may attach a prize"
  on public.checkins for update
  to anon
  using (prize is null or prize = '')
  with check (true);

-- No SELECT and no DELETE policy for anon is deliberate. With RLS on and no
-- matching policy, those are denied. Verify after running this:
--
--   curl "https://YOUR-PROJECT.supabase.co/rest/v1/checkins?select=*" \
--        -H "apikey: YOUR_ANON_KEY"
--
-- Expect an empty array `[]` — that is RLS refusing to hand rows to anon.
-- If it returns guest rows, stop and fix the policies before the event.
--
-- An empty array is what success looks like here. It is NOT the same as "the
-- table is empty" — anon simply cannot see rows. Check the row count in the
-- dashboard's Table Editor, where you are logged in as yourself.

-- Authenticated staff (anyone you invite to the Supabase project) read it in
-- the dashboard. If you later add a real staff login to a web app, add:
--   create policy "staff may read" on public.checkins
--     for select to authenticated using (true);
