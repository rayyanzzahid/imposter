import { createClient } from './supabase/client'

export async function submitVote(roundId: string, voterId: string, votedForId: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('votes')
    .insert({ round_id: roundId, voter_id: voterId, voted_for_id: votedForId })
  if (error) throw error
}