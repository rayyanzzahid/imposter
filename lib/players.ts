import { kickPlayerAction, leaveRoomAction, toggleReadyAction } from '@/app/actions/players'

export async function toggleReady(playerId: string) {
  await toggleReadyAction(playerId)
}

export async function kickPlayer(playerId: string) {
  await kickPlayerAction(playerId)
}

export async function leaveRoom(playerId: string) {
  await leaveRoomAction(playerId)
}

export async function startGame(roomId: string) {
  const { createClient } = await import('./supabase/client')
  const supabase = createClient()
  const { error } = await supabase
    .from('rooms')
    .update({ status: 'playing' })
    .eq('id', roomId)
  if (error) throw error
}
