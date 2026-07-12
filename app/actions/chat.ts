'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { findSessionPlayer } from '@/lib/session'
import type { ChatMessage } from '@/lib/supabase/types'

export async function getChatMessagesAction(roomId: string) {
  const supabase = createAdminClient()
  await findSessionPlayer(supabase, roomId)
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
  const player = await findSessionPlayer(supabase, roomId, playerId)
  const recentWindow = new Date(Date.now() - 5000).toISOString()
  const { count, error: countError } = await supabase
    .from('chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('room_id', roomId)
    .eq('player_id', player.id)
    .gte('created_at', recentWindow)

  if (countError) throw countError
  if ((count ?? 0) >= 5) throw new Error('Slow down before sending more messages.')

  const { error } = await supabase
    .from('chat_messages')
    .insert({ room_id: roomId, player_id: player.id, text: trimmed.slice(0, 300) })

  if (error) throw error
}
