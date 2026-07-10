'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getRoomPlayerId, getUserId } from '@/lib/auth'
import { toggleReady, kickPlayer, leaveRoom } from '@/lib/players'
import { setRoomCategory, setTotalRounds } from '@/lib/rooms'
import { startRound } from '@/app/actions/game'
import { getLobbyStateAction } from '@/app/actions/players'
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

    const timeout = window.setTimeout(loadPlayers, 0)
    return () => window.clearTimeout(timeout)
  }, [loadPlayers, userId])

  useEffect(() => {
    if (!userId) return
    const interval = window.setInterval(loadPlayers, 1800)
    return () => window.clearInterval(interval)
  }, [loadPlayers, userId])

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

  return (
    <main className="spy-screen">
      <div className="screen-shadows" aria-hidden="true" />
      <section className="page-stack">
        <div className="center-title">
          <p className="case-label">Room code</p>
          <h1 className="room-code">{room.code}</h1>
          <button onClick={handleCopyCode} className="secondary-action copy-code-action">
            {copied ? 'Code copied' : 'Copy room code'}
          </button>
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
                        {player.is_host ? 'Room owner' : isMe ? 'You' : 'Participant'}
                      </small>
                    </span>
                    <span className={`status-pill ${player.is_ready ? 'ready' : ''}`}>
                      {player.is_ready ? 'Ready' : 'Not ready'}
                    </span>
                    {isHost && !player.is_host && (
                      <button onClick={() => kickPlayer(player.id)} className="text-button">
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
                    ready
                  </span>
                  <span>
                    <strong>{waitingCount}</strong>
                    waiting
                  </span>
                </div>

                <div className="field-stack">
                  <label>
                    <span className="case-label">Question pack</span>
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
                    <span className="case-label">Rounds</span>
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
                  className="secondary-action"
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

              <button onClick={handleLeave} className="text-button">
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
