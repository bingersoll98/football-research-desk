-- Run in Supabase SQL editor. Then paste URL + anon key into app/config.js.

create table if not exists public.books (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{"unit":25,"bets":[],"flyer":[]}'::jsonb,
  updated_at timestamptz default now()
);

alter table public.books enable row level security;
create policy "own book read" on public.books for select using (auth.uid() = user_id);
create policy "own book write" on public.books for insert with check (auth.uid() = user_id);
create policy "own book update" on public.books for update using (auth.uid() = user_id);
