import { createClient } from './supabase/client'

export async function uploadAvatar(file: File): Promise<string> {
  const supabase = createClient()
  const fileExt = file.name.split('.').pop()
  const fileName = `${crypto.randomUUID()}.${fileExt}`

  const { error } = await supabase.storage.from('avatars').upload(fileName, file, {
    cacheControl: '3600',
    upsert: false,
  })
  if (error) throw error

  const { data } = supabase.storage.from('avatars').getPublicUrl(fileName)
  return data.publicUrl
}