-- Frog King global leaderboard setup (Supabase SQL Editor)
-- Run once in your Supabase project.

create table if not exists public.frog_leaderboard (
  player_id text primary key,
  name text not null,
  stars integer not null default 0,
  crowns integer not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists frog_leaderboard_stars_idx
  on public.frog_leaderboard (stars desc, crowns desc, updated_at asc);

alter table public.frog_leaderboard enable row level security;

drop policy if exists "frog_leaderboard_select_all" on public.frog_leaderboard;
create policy "frog_leaderboard_select_all"
on public.frog_leaderboard
for select
to anon
using (true);

drop policy if exists "frog_leaderboard_insert_all" on public.frog_leaderboard;
create policy "frog_leaderboard_insert_all"
on public.frog_leaderboard
for insert
to anon
with check (true);

drop policy if exists "frog_leaderboard_update_all" on public.frog_leaderboard;
create policy "frog_leaderboard_update_all"
on public.frog_leaderboard
for update
to anon
using (true)
with check (true);
