'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getRoomPlayerId, getUserId } from '@/lib/auth'
import { toggleReady, kickPlayer, leaveRoom } from '@/lib/players'
import { setRoomCategory, setTotalRounds } from '@/lib/rooms'
import { startRound } from '@/app/actions/game'
import { getLobbyStateAction } from '@/app/actions/players'
import { createClient } from '@/lib/supabase/client'
import { AvatarBadge } from '@/app/components/AvatarBadge'
import type { Room, Player } from '@/lib/supabase/types'
import Chat from '@/components/Chat'

const CATEGORIES = [
  { value: 'all', label: 'All categories' },
  { value: 'general', label: 'Friend group classics' },
  { value: 'school', label: 'School days' },
  { value: 'university', label: 'University life' },
  { value: 'gaming', label: 'Gamer mode' },
  { value: 'sports', label: 'Game day' },
  { value: 'office', label: 'Office antics' },
  { value: 'travel', label: 'On the road' },
]

export default function LobbyRoom({ room }: { room: Room }) {
  const router = useRouter()
  const [players, setPlayers] = useState<Player[]>([])
  const [category, setCategory] = useState(room.category ?? 'all')
  const [totalRounds, setTotalRoundsState] = useState(room.total_rounds ?? 5)
  const [starting, setStarting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [roomPlayerId, setRoomPlayerIdState] = useState<string | null>(null)

  useEffect(() => {
    getUserId().then(setUserId)
    const timeout = window.setTimeout(() => setRoomPlayerIdState(getRoomPlayerId(room.code)), 0)
    return () => window.clearTimeout(timeout)
  }, [room.code])

  const me = players.find((p) => p.id === roomPlayerId) ?? players.find((p) => p.user_id === userId)
  const isHost = me?.is_host ?? false
  const readyCount = players.filter((p) => p.is_ready).length
  const waitingCount = Math.max(0, players.length - readyCount)

  const loadPlayers = useCallback(async () => {
    const data = await getLobbyStateAction(room.id)
    setPlayers(data.players)
    if (data.status === 'playing') router.push(`/game/${room.code}`)
  }, [room.id, room.code, router])

  useEffect(() => {
    if (!userId) return

    const supabase = createClient()
    const channel = supabase
      .channel(`lobby:${room.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${room.id}` }, loadPlayers)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` }, loadPlayers)
      .subscribe()

    const timeout = window.setTimeout(() => void loadPlayers(), 0)

    return () => {
      window.clearTimeout(timeout)
      void supabase.removeChannel(channel)
    }
  }, [loadPlayers, room.id, userId])

  async function handleLeave() {
    if (me) await leaveRoom(me.id)
    router.push('/')
  }

  async function handleStart() {
    if (starting) return
    setStarting(true)
    try {
      await startRound(room.id)
      router.push(`/game/${room.code}`)
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

  async function handleCopyJoinLink() {
    const joinLink = `${window.location.origin}/?join=${room.code}`
    await navigator.clipboard.writeText(joinLink)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 1500)
  }

  return (
    <main className="spy-screen">
      <div className="screen-shadows" aria-hidden="true" />
      <section className="page-stack">
        <div className="center-title">
          <p className="case-label">Room code</p>
          <div className="room-code-line">
            <h1 className="room-code">{room.code}</h1>
            <button
              onClick={handleCopyCode}
              className={`secondary-action icon-action copy-code-action ${copied ? 'is-copied' : ''}`}
              aria-label={copied ? 'Room code copied' : 'Copy room code'}
              title={copied ? 'Code copied' : 'Copy room code'}
            >
              <svg className="utility-icon copy-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 7V5.5A2.5 2.5 0 0 1 10.5 3h8A2.5 2.5 0 0 1 21 5.5v9a2.5 2.5 0 0 1-2.5 2.5H17" />
                <rect x="3" y="7" width="14" height="14" rx="2.5" />
                <path d="M6.5 11h7M6.5 14.5h5" />
              </svg>
            </button>
            <button
              onClick={handleCopyJoinLink}
              className={`secondary-action icon-action copy-code-action ${linkCopied ? 'is-copied' : ''}`}
              aria-label={linkCopied ? 'Join link copied' : 'Copy join link'}
              title={linkCopied ? 'Join link copied' : 'Copy join link'}
            >
              <svg className="utility-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M10 13.5 14 9.5" />
                <path d="M7.5 16.5 6 18a3 3 0 0 1-4.2-4.2l3.7-3.7a3 3 0 0 1 4.2 0" />
                <path d="m16.5 7.5 1.5-1.5a3 3 0 0 1 4.2 4.2l-3.7 3.7a3 3 0 0 1-4.2 0" />
              </svg>
            </button>
          </div>
        </div>

        <div className="compact-grid">
          <section className="room-panel">
            <p className="case-label">Agents</p>
            <div className="player-list mt-3">
              {players.map((player) => {
                const isMe = player.id === roomPlayerId || (!roomPlayerId && player.user_id === userId)
                return (
                  <div key={player.id} className={`player-row ${isMe ? 'is-you' : ''}`}>
                    <AvatarBadge avatar={player.avatar} name={player.name} />
                    <span>
                      <strong>{player.name}</strong>
                      <small className="block text-muted">
                        {player.is_host ? 'Room owner' : isMe ? 'You' : 'Field agent'}
                      </small>
                    </span>
                    <span className={`status-pill ${player.is_ready ? 'ready' : ''}`}>
                      {player.is_ready ? 'Ready' : 'Not ready'}
                    </span>
                    {isHost && !player.is_host && (
                      <button
                        onClick={() => kickPlayer(player.id)}
                        className="text-button kick-action"
                        aria-label={`Kick ${player.name}`}
                        title={`Kick ${player.name}`}
                      >
                        Kick
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          <section className="mission-panel">
            <p className="case-label">{isHost ? 'Host controls' : 'Your status'}</p>

            {isHost && (
              <>
                <div className="host-readiness">
                  <span>
                    <strong>{readyCount}</strong>
                    <small className="readiness-label">Cleared</small>
                  </span>
                  <span>
                    <strong>{waitingCount}</strong>
                    <small className="readiness-label">Standby</small>
                  </span>
                </div>

                <div className="field-stack">
                  <label>
                    <span className="case-label control-label">Question pack</span>
                    <select
                      value={category}
                      onChange={(e) => handleCategoryChange(e.target.value)}
                      className="spy-select"
                    >
                      {CATEGORIES.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span className="case-label control-label">Rounds</span>
                    <select
                      value={totalRounds}
                      onChange={(e) => handleRoundsChange(Number(e.target.value))}
                      className="spy-select"
                    >
                      {[3, 5, 7, 10].map((rounds) => (
                        <option key={rounds} value={rounds}>
                          {rounds} rounds
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </>
            )}

            <div className="lobby-stack mt-4">
              {me && (
                <button
                  onClick={async () => {
                    await toggleReady(me.id, me.is_ready)
                    await loadPlayers()
                  }}
                  className={`secondary-action ready-toggle ${me.is_ready ? 'is-ready' : ''}`}
                >
                  {me.is_ready ? 'Cancel Ready' : 'Ready Up'}
                </button>
              )}

              {isHost && (
                <button
                  onClick={handleStart}
                  disabled={starting || players.length < 3 || !players.every((p) => p.is_ready)}
                  className="primary-action"
                >
                  {starting ? 'Starting...' : 'Start Game'}
                </button>
              )}

              <button onClick={handleLeave} className="text-button leave-action">
                Leave room
              </button>
            </div>
          </section>
        </div>
      </section>

      <Chat roomId={room.id} me={me ?? null} players={players} />
    </main>
  )
}
