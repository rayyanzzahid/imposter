export type Room = {
  id: string
  code: string
  host_id: string
  status: 'lobby' | 'playing' | 'ended'
  category: string
  total_rounds: number
  created_at: string
}

export type Player = {
  id: string
  room_id: string
  session_id: string
  name: string
  is_host: boolean
  is_ready: boolean
  score: number
  created_at: string
}

export type Round = {
  id: string
  room_id: string
  round_number: number
  question_id: string
  imposter_question_id: string
  imposter_player_id: string
  phase: 'role_reveal' | 'answering' | 'question_reveal' | 'discussion' | 'voting' | 'reveal'
  discussion_ends_at: string | null
  created_at: string
}

export type Answer = {
  id: string
  round_id: string
  player_id: string
  answered_player_id: string
  text: string
  created_at: string
}
export type Question = {
  id: string
  pack_id: string
  text: string
}
export type Vote = {
  id: string
  round_id: string
  voter_id: string
  voted_for_id: string
  created_at: string
}