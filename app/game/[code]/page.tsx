import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import GameRoom from './GameRoom'

export default async function GamePage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  const supabase = await createClient()

  const { data: room } = await supabase
    .from('rooms')
    .select()
    .eq('code', code.toUpperCase())
    .single()

  if (!room) notFound()

  return <GameRoom room={room} />
}