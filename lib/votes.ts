import { submitVoteAction } from '@/app/actions/game-state'

export async function submitVote(roundId: string, voterId: string, votedForId: string) {
  await submitVoteAction(roundId, voterId, votedForId)
}
