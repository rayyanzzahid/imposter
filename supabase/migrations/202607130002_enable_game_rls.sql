-- Lock public game tables so the browser anon key cannot read or write them directly.
-- Server actions use the Supabase service key and perform membership/host validation.

alter table if exists public.rooms enable row level security;
alter table if exists public.players enable row level security;
alter table if exists public.rounds enable row level security;
alter table if exists public.answers enable row level security;
alter table if exists public.votes enable row level security;
alter table if exists public.discussion_skips enable row level security;
alter table if exists public.chat_messages enable row level security;
alter table if exists public.questions enable row level security;

drop policy if exists "deny anon rooms" on public.rooms;
drop policy if exists "deny anon players" on public.players;
drop policy if exists "deny anon rounds" on public.rounds;
drop policy if exists "deny anon answers" on public.answers;
drop policy if exists "deny anon votes" on public.votes;
drop policy if exists "deny anon discussion skips" on public.discussion_skips;
drop policy if exists "deny anon chat messages" on public.chat_messages;
drop policy if exists "deny anon questions" on public.questions;

create policy "deny anon rooms" on public.rooms
  for all to anon using (false) with check (false);

create policy "deny anon players" on public.players
  for all to anon using (false) with check (false);

create policy "deny anon rounds" on public.rounds
  for all to anon using (false) with check (false);

create policy "deny anon answers" on public.answers
  for all to anon using (false) with check (false);

create policy "deny anon votes" on public.votes
  for all to anon using (false) with check (false);

create policy "deny anon discussion skips" on public.discussion_skips
  for all to anon using (false) with check (false);

create policy "deny anon chat messages" on public.chat_messages
  for all to anon using (false) with check (false);

create policy "deny anon questions" on public.questions
  for all to anon using (false) with check (false);
