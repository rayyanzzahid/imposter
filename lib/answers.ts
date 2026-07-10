import { submitAnswerAction } from '@/app/actions/game-state'

export async function submitAnswer(roundId: string, playerId: string, answeredPlayerId: string, answeredPlayerName: string) {
  await submitAnswerAction(roundId, playerId, answeredPlayerId, answeredPlayerName)
}
