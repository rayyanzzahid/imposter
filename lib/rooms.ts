import { createRoomAction, joinRoomAction } from '@/app/actions/rooms'
import { createClient } from './supabase/client'
import { getUserId, setRoomPlayerId } from './auth'

function supabaseMessage(label: string, error: unknown) {
  if (error instanceof Error) return `${label}: ${error.message}`
  if (error && typeof error === 'object') {
    const details = error as { message?: string; details?: string; hint?: string; code?: string }
    return [
      label,
      details.message,
      details.details,
      details.hint,
      details.code ? `code ${details.code}` : undefined,
    ].filter(Boolean).join(': ')
  }
  return `${label}: ${String(error)}`
}

export async function createRoom(hostName: string, avatar: string) {
  const userId = await getUserId()
  const room = await createRoomAction(hostName, avatar, userId)
  setRoomPlayerId(room.code, room.playerId)
  return room.code
}

export async function joinRoom(code: string, playerName: string, avatar: string) {
  const userId = await getUserId()
  const room = await joinRoomAction(code, playerName, avatar, userId)
  setRoomPlayerId(room.code, room.playerId)
  return room.code
}

export async function setRoomCategory(roomId: string, category: string) {
  const supabase = createClient()
  const { error } = await supabase.from('rooms').update({ category }).eq('id', roomId)
  if (error) throw new Error(supabaseMessage('Could not update room category', error))
}

export async function setTotalRounds(roomId: string, totalRounds: number) {
  const supabase = createClient()
  const { error } = await supabase.from('rooms').update({ total_rounds: totalRounds }).eq('id', roomId)
  if (error) throw new Error(supabaseMessage('Could not update total rounds', error))
}
