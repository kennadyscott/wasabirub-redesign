-- WasabiRub build-review — live collaboration backend (Supabase)
-- Run this once in your Supabase project: SQL Editor → New query → paste → Run.
-- The checklist is non-sensitive QA data, so the policies below intentionally
-- allow anyone holding the project's public "anon" key to read/write this one table.

create table if not exists public.review_state (
  id          text primary key,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

alter table public.review_state enable row level security;

-- Open read/write for the anon (public) key. Scoped to this table only.
drop policy if exists "review_state read"   on public.review_state;
drop policy if exists "review_state insert" on public.review_state;
drop policy if exists "review_state update" on public.review_state;

create policy "review_state read"   on public.review_state for select using (true);
create policy "review_state insert" on public.review_state for insert with check (true);
create policy "review_state update" on public.review_state for update using (true) with check (true);

-- Turn on realtime so edits broadcast live to everyone viewing.
alter publication supabase_realtime add table public.review_state;

-- Done. In the tool, click "Live sync", paste your Project URL + anon key,
-- then send the copied live link to Jessie. You'll both edit in real time.
