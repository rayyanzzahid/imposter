import { markSkipDiscussionAction } from '@/app/actions/game-state'

export async function markSkipDiscussion(roundId: string) {
  await markSkipDiscussionAction(roundId)
}
