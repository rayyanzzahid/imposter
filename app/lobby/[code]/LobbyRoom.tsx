'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getUserId } from '@/lib/auth'
import { toggleReady, kickPlayer, leaveRoom } from '@/lib/players'
import { setRoomCategory, setTotalRounds } from '@/lib/rooms'
import { startRound } from '@/app/actions/game'
import type { Room, Player } from '@/lib/supabase/types'

const CATEGORIES = [
  { value: 'all', label: 'All Categories' },
  { value: 'general', label: 'Friend Group Classics' },
  { value: 'school', label: 'School Days' },
  { value: 'university', label: 'University Life' },
  { value: 'gaming', label: 'Gamer Mode' },
  { value: 'sports', label: 'Game Day' },
  { value: 'office', label: 'Office Antics' },
  { value: 'travel', label: 'On the Road' },
]

function Avatar({ emoji }: { emoji: string }) {
  return (
    <div className="w-8 h-8 rounded-full bg-surface border border-white/10 flex items-center justify-center shrink-0 text-sm">
      {emoji}
    </div>
  )
}

export default function LobbyRoom({ room }: { room: Room }) {
  const router = useRouter()
  const supabase = createClient()
  const [players, setPlayers] = useState<Player[]>([])
  const [category, setCategory] = useState(room.category ?? 'all')
  const [totalRounds, setTotalRoundsState] = useState(room.total_rounds ?? 5)
  const [starting, setStarting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    getUserId().then(setUserId)
  }, [])

  const me = players.find((p) => p.user_id === userId)
  const isHost = me?.is_host ?? false

  useEffect(() => {
    if (!userId) return

    async function loadPlayers() {
      const { data } = await supabase
        .from('players')
        .select()
        .eq('room_id', room.id)
        .order('created_at', { ascending: true })
      if (data) setPlayers(data)
    }
    loadPlayers()

    const channel = supabase
      .channel(`room-${room.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${room.id}` },
        () => loadPlayers()
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` },
        (payload) => {
          if (payload.new.status === 'playing') {
            router.push(`/game/${room.code}`)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [room.id, room.code, router, supabase, userId])

  async function handleLeave() {
    if (me) await leaveRoom(me.id)
    router.push('/')
  }

  async function handleStart() {
    if (starting) return
    setStarting(true)
    try {
      await startRound(room.id)
    } finally {
      setStarting(false)
    }
  }

  async function handleCategoryChange(value: string) {
    setCategory(value)
    await setRoomCategory(room.id, value)
  }

  async function handleRoundsChange(value: number) {
    setTotalRoundsState(value)
    await setTotalRounds(room.id, value)
  }

  async function handleCopyCode() {
    await navigator.clipboard.writeText(room.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 px-6 py-12">
      <div className="text-center">
        <p className="case-label">Case File No.</p>
        <div className="flex items-center gap-3 justify-center mt-1">
          <h1
            className="text-4xl font-black tracking-widest text-evidence-gold"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {room.code}
          </h1>
          <button
            onClick={handleCopyCode}
            className="rounded-lg bg-surface border border-white/10 px-3 py-2 text-sm text-paper"
          >
            {copied ? '✓' : 'Copy'}
          </button>
        </div>
      </div>

      <div className="w-full max-w-sm flex flex-col gap-3">
        {players.map((player) => (
          <div
            key={player.id}
            className="flex items-center justify-between rounded-xl bg-surface px-4 py-3 border border-white/10"
          >
            <div className="flex items-center gap-2">
              <Avatar emoji={player.avatar_url} />
              {player.is_host && <span title="Host">👑</span>}
              <span className="text-paper font-medium">{player.name}</span>
              {player.user_id === userId && (
                <span className="text-muted text-xs">(you)</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  player.is_ready
                    ? 'bg-stamp-green/20 text-stamp-green'
                    : 'bg-white/10 text-muted'
                }`}
              >
                {player.is_ready ? 'Ready' : 'Not ready'}
              </span>
              {isHost && !player.is_host && (
                <button
                  onClick={() => kickPlayer(player.id)}
                  className="text-case-red text-xs"
                >
                  Kick
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="w-full max-w-sm flex flex-col gap-3 mt-4">
        {isHost && (
          <div>
            <label className="case-label mb-1 block">Category</label>
            <select
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="w-full rounded-xl bg-surface px-4 py-3 text-paper border border-white/10 outline-none"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>

            <div className="mt-3">
              <label className="case-label mb-1 block">Number of Rounds</label>
              <select
                value={totalRounds}
                onChange={(e) => handleRoundsChange(Number(e.target.value))}
                className="w-full rounded-xl bg-surface px-4 py-3 text-paper border border-white/10 outline-none"
              >
                {[3, 5, 7, 10].map((n) => (
                  <option key={n} value={n}>{n} rounds</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {me && (
          <button
            onClick={() => toggleReady(me.id, me.is_ready)}
            className="rounded-2xl bg-surface px-6 py-4 font-bold text-paper border border-white/10"
          >
            {me.is_ready ? 'Not Ready' : "I'm Ready"}
          </button>
        )}

        {isHost && (
          <button
            onClick={handleStart}
            disabled={starting || players.length < 3 || !players.every((p) => p.is_ready)}
            className="rounded-2xl bg-case-red px-6 py-4 font-bold text-paper disabled:opacity-40"
          >
            {starting ? 'Starting...' : 'Start Game'}
          </button>
        )}

        <button onClick={handleLeave} className="text-muted text-sm">
          Leave Room
        </button>
      </div>
    </main>
  )
}