import { markSkipDiscussionAction } from '@/app/actions/game-state'

export async function markSkipDiscussion(roundId: string, roomPlayerId?: string | null) {
  await markSkipDiscussionAction(roundId, roomPlayerId)
}
