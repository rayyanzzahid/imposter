import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import LobbyRoom from './LobbyRoom'

export default async function LobbyPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  const supabase = createAdminClient()

  const { data: room } = await supabase
    .from('rooms')
    .select()
    .eq('code', code.toUpperCase())
    .single()

  if (!room) notFound()

  return <LobbyRoom room={room} />
}
