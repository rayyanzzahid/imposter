import { createHmac, randomUUID, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Player } from './supabase/types'
import { createClient as createSupabaseServerClient } from './supabase/server'

const SESSION_COOKIE = 'find-the-traitor-session'
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

function sessionSecret() {
  const secret = process.env.SESSION_SECRET
    ?? process.env.SUPABASE_SECRET_KEY
    ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error('Server session secret is missing')
  return secret
}

function signUserId(userId: string) {
  return createHmac('sha256', sessionSecret()).update(userId).digest('base64url')
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

function encodeSession(userId: string) {
  return `${userId}.${signUserId(userId)}`
}

function decodeSession(value: string | undefined) {
  if (!value) return null
  const [userId, signature] = value.split('.')
  if (!userId || !signature) return null
  return safeEqual(signature, signUserId(userId)) ? userId : null
}

export async function getSessionUserId() {
  const cookieStore = await cookies()
  const legacyUserId = decodeSession(cookieStore.get(SESSION_COOKIE)?.value)
  if (legacyUserId) return legacyUserId

  const supabase = await createSupabaseServerClient()
  const { data: authUser } = await supabase.auth.getUser()
  if (authUser.user) return authUser.user.id

  return null
}

export async function getOrCreateSessionUserId() {
  const existingUserId = await getSessionUserId()
  if (existingUserId) {
    const cookieStore = await cookies()
    cookieStore.set(SESSION_COOKIE, encodeSession(existingUserId), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: ONE_YEAR_SECONDS,
      path: '/',
    })
    return existingUserId
  }

  const userId = randomUUID()
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, encodeSession(userId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: ONE_YEAR_SECONDS,
    path: '/',
  })
  return userId
}

export async function requireSessionUserId() {
  const userId = await getSessionUserId()
  if (!userId) throw new Error('Your session expired. Rejoin the room.')
  return userId
}

export async function findSessionPlayer(
  supabase: SupabaseClient,
  roomId: string,
  roomPlayerId?: string | null
) {
  const userId = await requireSessionUserId()
  let player: Player | null = null

  if (roomPlayerId) {
    const { data } = await supabase
      .from('players')
      .select()
      .eq('id', roomPlayerId)
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle()

    player = (data ?? null) as Player | null
  }

  if (!player) {
    const { data } = await supabase
      .from('players')
      .select()
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle()

    player = (data ?? null) as Player | null
  }

  if (!player) throw new Error('You are not a member of this room.')
  return player
}

export async function requireHostPlayer(
  supabase: SupabaseClient,
  roomId: string,
  roomPlayerId?: string | null
) {
  const player = await findSessionPlayer(supabase, roomId, roomPlayerId)
  if (!player.is_host) throw new Error('Only the room owner can do that.')
  return player
}
