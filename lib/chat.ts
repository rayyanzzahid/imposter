import { createClient } from './supabase/client'

export async function sendChatMessage(roomId: string, playerId: string, text: string) {
  const trimmed = text.trim()
  if (!trimmed) return
  const supabase = createClient()
  const { error } = await supabase
    .from('chat_messages')
    .insert({ room_id: roomId, player_id: playerId, text: trimmed.slice(0, 300) })
  if (error) throw error
}