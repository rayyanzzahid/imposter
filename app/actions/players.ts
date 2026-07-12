'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { findSessionPlayer, requireHostPlayer, requireSessionUserId } from '@/lib/session'
import type { Player } from '@/lib/supabase/types'

export async function getRoomPlayersAction(roomId: string) {
  const supabase = createAdminClient()
  await findSessionPlayer(supabase, roomId)
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
  await findSessionPlayer(supabase, roomId)
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

export async function toggleReadyAction(playerId: string) {
  const supabase = createAdminClient()
  const userId = await requireSessionUserId()
  const { data: player, error: playerError } = await supabase
    .from('players')
    .select('id,is_ready')
    .eq('id', playerId)
    .eq('user_id', userId)
    .single()

  if (playerError || !player) throw new Error('You can only change your own ready state.')

  const { error } = await supabase.from('players').update({ is_ready: !player.is_ready }).eq('id', player.id)
  if (error) throw error
}

export async function kickPlayerAction(playerId: string) {
  const supabase = createAdminClient()
  const { data: target, error: targetError } = await supabase
    .from('players')
    .select('id,room_id,is_host')
    .eq('id', playerId)
    .single()

  if (targetError || !target) throw new Error('Player not found')
  if (target.is_host) throw new Error('The room owner cannot be kicked.')

  await requireHostPlayer(supabase, target.room_id)
  const { error } = await supabase.from('players').delete().eq('id', playerId)
  if (error) throw error
}

export async function leaveRoomAction(playerId: string) {
  const supabase = createAdminClient()
  const userId = await requireSessionUserId()
  const { data: player, error: playerError } = await supabase
    .from('players')
    .select('id')
    .eq('id', playerId)
    .eq('user_id', userId)
    .single()

  if (playerError || !player) throw new Error('You can only leave as yourself.')

  const { error } = await supabase.from('players').delete().eq('id', playerId)
  if (error) throw error
}
