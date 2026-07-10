import { sendChatMessageAction } from '@/app/actions/chat'

export async function sendChatMessage(roomId: string, playerId: string, text: string) {
  await sendChatMessageAction(roomId, playerId, text)
}
