import { markSkipDiscussionAction } from '@/app/actions/game-state'

export async function markSkipDiscussion(roundId: string, playerId: string) {
  await markSkipDiscussionAction(roundId, playerId)
}
