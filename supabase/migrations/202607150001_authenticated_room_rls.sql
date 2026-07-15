-- Secure browser access for the Supabase Auth migration.
-- Server actions use the service role and continue to bypass these policies.

create or replace function public.is_room_member(target_room_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.players
    where room_id = target_room_id
      and user_id = auth.uid()
  );
$$;

revoke all on function public.is_room_member(uuid) from public;
grant execute on function public.is_room_member(uuid) to authenticated;

do $$
declare
  table_name text;
  policy_record record;
begin
  foreach table_name in array array[
    'rooms', 'players', 'rounds', 'answers', 'votes',
    'discussion_skips', 'chat_messages', 'questions', 'round_ready'
  ]
  loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('alter table public.%I enable row level security', table_name);

      for policy_record in
        select policyname
        from pg_policies
        where schemaname = 'public' and tablename = table_name
      loop
        execute format('drop policy if exists %I on public.%I', policy_record.policyname, table_name);
      end loop;
    end if;
  end loop;
end $$;

-- Read-only room visibility for signed-in anonymous players.
create policy "room members can read rooms" on public.rooms
  for select to authenticated
  using (public.is_room_member(id));

create policy "room members can read players" on public.players
  for select to authenticated
  using (public.is_room_member(room_id));

create policy "room members can read chat" on public.chat_messages
  for select to authenticated
  using (public.is_room_member(room_id));

-- Answers and votes stay server-only so hidden choices cannot leak through
-- direct table reads or Realtime change payloads before their reveal phase.
create policy "deny browser answers" on public.answers
  for all to anon, authenticated using (false) with check (false);

create policy "deny browser votes" on public.votes
  for all to anon, authenticated using (false) with check (false);

create policy "deny browser skips" on public.discussion_skips
  for all to anon, authenticated using (false) with check (false);

create policy "deny browser questions" on public.questions
  for all to anon, authenticated using (false) with check (false);

create policy "deny browser round ready" on public.round_ready
  for all to anon, authenticated using (false) with check (false);
