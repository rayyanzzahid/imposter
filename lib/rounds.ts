import { createClient } from './supabase/client'

export async function markSkipDiscussion(roundId: string, playerId: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('discussion_skips')
    .insert({ round_id: roundId, player_id: playerId })
  if (error && error.code !== '23505') throw error
}