import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { findSessionPlayer } from '@/lib/session'
import GameRoom from './GameRoom'

export default async function GamePage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  const supabase = createAdminClient()

  const { data: room } = await supabase
    .from('rooms')
    .select('id,code,status,category,total_rounds')
    .eq('code', code.toUpperCase())
    .maybeSingle()

  if (!room) notFound()

  try {
    await findSessionPlayer(supabase, room.id)
  } catch {
    notFound()
  }

  return <GameRoom room={room} />
}