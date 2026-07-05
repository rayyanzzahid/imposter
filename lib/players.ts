import { createClient } from './supabase/client'

export async function toggleReady(playerId: string, isReady: boolean) {
  const supabase = createClient()
  const { error } = await supabase
    .from('players')
    .update({ is_ready: !isReady })
    .eq('id', playerId)
  if (error) throw error
}

export async function kickPlayer(playerId: string) {
  const supabase = createClient()
  const { error } = await supabase.from('players').delete().eq('id', playerId)
  if (error) throw error
}

export async function leaveRoom(playerId: string) {
  const supabase = createClient()
  const { error } = await supabase.from('players').delete().eq('id', playerId)
  if (error) throw error
}

export async function startGame(roomId: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('rooms')
    .update({ status: 'playing' })
    .eq('id', roomId)
  if (error) throw error
}