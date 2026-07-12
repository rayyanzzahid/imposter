import { submitVoteAction } from '@/app/actions/game-state'

export async function submitVote(roundId: string, votedForId: string) {
  await submitVoteAction(roundId, votedForId)
}
