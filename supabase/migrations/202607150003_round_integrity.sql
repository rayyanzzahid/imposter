-- Prevent concurrent starts from creating duplicate round numbers.
create unique index if not exists rounds_room_round_number_unique
  on public.rounds (room_id, round_number);
