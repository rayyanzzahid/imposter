import { createClient } from './supabase/client'

export async function submitAnswer(roundId: string, playerId: string, answeredPlayerId: string, answeredPlayerName: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('answers')
    .insert({ round_id: roundId, player_id: playerId, answered_player_id: answeredPlayerId, text: answeredPlayerName })
  if (error) throw error
}