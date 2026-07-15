'use client'

import { createClient } from './client'

/**
 * Establish a Supabase Auth identity before a player joins or creates a room.
 * During migration this is best-effort so existing custom-cookie sessions
 * continue to work if anonymous sign-ins are not enabled yet.
 */
export async function ensureAnonymousAuth() {
  const supabase = createClient()
  const { data: existing } = await supabase.auth.getUser()
  if (existing.user) return existing.user.id

  const { data, error } = await supabase.auth.signInAnonymously()
  if (error) {
    console.warn('Supabase anonymous auth is unavailable; using legacy session.', error.message)
    return null
  }

  return data.user?.id ?? null
}

