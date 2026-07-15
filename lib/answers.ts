import { submitAnswerAction } from '@/app/actions/game-state'

export async function submitAnswer(roundId: string, answeredPlayerId: string, roomPlayerId?: string | null) {
  await submitAnswerAction(roundId, answeredPlayerId, roomPlayerId)
}
