import { createClient } from './supabase/client'
import { generateRoomCode } from './roomCode'
import { getSessionId } from './session'

async function nameTaken(supabase: ReturnType<typeof createClient>, roomId: string, name: string) {
  const { data } = await supabase
    .from('players')
    .select('id')
    .eq('room_id', roomId)
    .ilike('name', name.trim())
  return (data?.length ?? 0) > 0
}

export async function createRoom(hostName: string) {
  const supabase = createClient()
  const sessionId = getSessionId()
  const code = generateRoomCode()

  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .insert({ code, host_id: sessionId })
    .select()
    .single()

  if (roomError) throw roomError

  const { error: playerError } = await supabase
    .from('players')
    .insert({
      room_id: room.id,
      session_id: sessionId,
      name: hostName,
      is_host: true,
    })

  if (playerError) throw playerError

  return room.code
}

export async function joinRoom(code: string, playerName: string) {
  const supabase = createClient()
  const sessionId = getSessionId()

  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select()
    .eq('code', code.toUpperCase())
    .single()

  if (roomError || !room) throw new Error('Room not found')

  if (await nameTaken(supabase, room.id, playerName)) {
    throw new Error('That name is already taken in this room')
  }

  const { error: playerError } = await supabase
    .from('players')
    .insert({
      room_id: room.id,
      session_id: sessionId,
      name: playerName,
      is_host: false,
    })

  if (playerError) throw playerError

  return room.code
}

export async function setRoomCategory(roomId: string, category: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('rooms')
    .update({ category })
    .eq('id', roomId)
  if (error) throw error
}

export async function setTotalRounds(roomId: string, totalRounds: number) {
  const supabase = createClient()
  const { error } = await supabase
    .from('rooms')
    .update({ total_rounds: totalRounds })
    .eq('id', roomId)
  if (error) throw error
}