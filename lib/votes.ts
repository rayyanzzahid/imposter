import { submitVoteAction } from '@/app/actions/game-state'

export async function submitVote(roundId: string, votedForId: string, roomPlayerId?: string | null) {
  await submitVoteAction(roundId, votedForId, roomPlayerId)
}
