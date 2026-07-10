'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import type { ChatMessage } from '@/lib/supabase/types'

export async function getChatMessagesAction(roomId: string) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('chat_messages')
    .select()
    .eq('room_id', roomId)
    .order('created_at', { ascending: true })
    .limit(200)

  if (error) throw error
  return (data ?? []) as ChatMessage[]
}

export async function sendChatMessageAction(roomId: string, playerId: string, text: string) {
  const trimmed = text.trim()
  if (!trimmed) return

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('chat_messages')
    .insert({ room_id: roomId, player_id: playerId, text: trimmed.slice(0, 300) })

  if (error) throw error
}
