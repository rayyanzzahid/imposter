-- Round rows contain the hidden traitor and question IDs. Keep them server-only.
drop policy if exists "room members can read rounds" on public.rounds;
drop policy if exists "deny browser rounds" on public.rounds;

create policy "deny browser rounds" on public.rounds
  for all to anon, authenticated
  using (false)
  with check (false);

-- Membership checks are only used by authenticated-room policies.
revoke execute on function public.is_room_member(uuid) from anon;

