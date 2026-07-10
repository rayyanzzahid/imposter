'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import type { Player } from '@/lib/supabase/types'

export async function getRoomPlayersAction(roomId: string) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('players')
    .select()
    .eq('room_id', roomId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as Player[]
}

export async function getLobbyStateAction(roomId: string) {
  const supabase = createAdminClient()
  const [{ data: players, error: playersError }, { data: room, error: roomError }] = await Promise.all([
    supabase.from('players').select().eq('room_id', roomId).order('created_at', { ascending: true }),
    supabase.from('rooms').select('status').eq('id', roomId).single(),
  ])

  if (playersError) throw playersError
  if (roomError) throw roomError
  return {
    players: (players ?? []) as Player[],
    status: room?.status as 'lobby' | 'playing' | 'ended',
  }
}

export async function toggleReadyAction(playerId: string, isReady: boolean) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('players').update({ is_ready: !isReady }).eq('id', playerId)
  if (error) throw error
}

export async function kickPlayerAction(playerId: string) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('players').delete().eq('id', playerId)
  if (error) throw error
}

export async function leaveRoomAction(playerId: string) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('players').delete().eq('id', playerId)
  if (error) throw error
}
