'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { generateRoomCode } from '@/lib/roomCode'
import { getOrCreateSessionUserId, requireHostPlayer } from '@/lib/session'

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

async function createUniqueRoom(userId: string) {
  const supabase = createAdminClient()

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = generateRoomCode()
    const { data: room, error } = await supabase
      .from('rooms')
      .insert({ code, host_user_id: userId })
      .select()
      .single()

    if (!error && room) return room
    if ((error as { code?: string } | null)?.code !== '23505') {
      throw new Error(supabaseMessage('Could not create room', error))
    }
  }

  throw new Error('Could not create room: room code collision')
}

async function ensureUser(userId: string, name: string, avatar: string) {
  const supabase = createAdminClient()
  const { data: existingUser } = await supabase.auth.admin.getUserById(userId)
  if (existingUser.user) return

  const { error } = await supabase.auth.admin.createUser({
    id: userId,
    email: `${userId}@find-the-traitor.local`,
    email_confirm: true,
    password: crypto.randomUUID(),
    user_metadata: {
      avatar,
      name: name.trim(),
    },
  })

  if (error) throw new Error(supabaseMessage('Could not prepare player profile', error))
}

async function isNameTaken(roomId: string, name: string) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('players')
    .select('id')
    .eq('room_id', roomId)
    .ilike('name', name.trim())

  if (error) throw new Error(supabaseMessage('Could not check player name', error))
  return (data?.length ?? 0) > 0
}

function cleanName(name: string) {
  const cleaned = name.trim().replace(/\s+/g, ' ').slice(0, 32)
  if (cleaned.length < 1) throw new Error('Enter your name first')
  return cleaned
}

function cleanAvatar(avatar: string) {
  const cleaned = avatar.trim()
  if (!cleaned.startsWith('/avatars/') || cleaned.includes('..')) {
    throw new Error('Invalid avatar')
  }
  return cleaned.slice(0, 120)
}

export async function createRoomAction(hostName: string, avatar: string) {
  const supabase = createAdminClient()
  const userId = await getOrCreateSessionUserId()
  const name = cleanName(hostName)
  const playerAvatar = cleanAvatar(avatar)
  await ensureUser(userId, name, playerAvatar)
  const room = await createUniqueRoom(userId)

  const { data: player, error: playerError } = await supabase.from('players').insert({
    room_id: room.id,
    user_id: userId,
    name,
    avatar: playerAvatar,
    is_host: true,
  }).select()
    .single()

  if (playerError) throw new Error(supabaseMessage('Could not add host player', playerError))
  if (!player) throw new Error('Could not add host player: no player returned')
  return { code: room.code as string, playerId: player.id as string }
}

export async function joinRoomAction(code: string, playerName: string, avatar: string) {
  const supabase = createAdminClient()
  const userId = await getOrCreateSessionUserId()
  const name = cleanName(playerName)
  const playerAvatar = cleanAvatar(avatar)
  await ensureUser(userId, name, playerAvatar)
  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select()
    .eq('code', code.trim().toUpperCase())
    .single()

  if (roomError || !room) throw new Error('Room not found')

  if (await isNameTaken(room.id, name)) {
    throw new Error('That name is already taken in this room')
  }

  const { data: player, error: playerError } = await supabase.from('players').insert({
    room_id: room.id,
    user_id: userId,
    name,
    avatar: playerAvatar,
    is_host: false,
  }).select()
    .single()

  if (playerError) throw new Error(supabaseMessage('Could not join room', playerError))
  if (!player) throw new Error('Could not join room: no player returned')
  return { code: room.code as string, playerId: player.id as string }
}

export async function setRoomCategoryAction(roomId: string, category: string, roomPlayerId: string | null) {
  const supabase = createAdminClient()
  await requireHostPlayer(supabase, roomId, roomPlayerId)

  const allowedCategories = new Set(['all', 'general', 'school', 'university', 'gaming', 'sports', 'office', 'travel'])
  if (!allowedCategories.has(category)) throw new Error('Invalid question pack')

  const { error } = await supabase.from('rooms').update({ category }).eq('id', roomId)
  if (error) throw new Error(supabaseMessage('Could not update room category', error))
}

export async function setTotalRoundsAction(roomId: string, totalRounds: number, roomPlayerId: string | null) {
  const supabase = createAdminClient()
  await requireHostPlayer(supabase, roomId, roomPlayerId)

  if (![3, 5, 7, 10].includes(totalRounds)) throw new Error('Invalid round count')

  const { error } = await supabase.from('rooms').update({ total_rounds: totalRounds }).eq('id', roomId)
  if (error) throw new Error(supabaseMessage('Could not update total rounds', error))
}
