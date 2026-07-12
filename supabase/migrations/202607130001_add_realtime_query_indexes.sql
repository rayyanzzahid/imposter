-- Indexes for the room and round lookups used by the live game.
create index if not exists players_room_id_created_at_idx
  on public.players (room_id, created_at);

create index if not exists rounds_room_id_round_number_idx
  on public.rounds (room_id, round_number desc);

create index if not exists answers_round_id_idx
  on public.answers (round_id);

create index if not exists votes_round_id_idx
  on public.votes (round_id);

create index if not exists discussion_skips_round_id_idx
  on public.discussion_skips (round_id);

create index if not exists chat_messages_room_id_created_at_idx
  on public.chat_messages (room_id, created_at);
