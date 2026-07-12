import { submitAnswerAction } from '@/app/actions/game-state'

export async function submitAnswer(roundId: string, answeredPlayerId: string) {
  await submitAnswerAction(roundId, answeredPlayerId)
}
