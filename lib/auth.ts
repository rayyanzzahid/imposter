import { createClient } from './supabase/client'

export async function getUserId(): Promise<string> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (session?.user) {
    return session.user.id
  }

  const { data, error } = await supabase.auth.signInAnonymously()
  if (error || !data.user) throw new Error('Could not start session')
  return data.user.id
}