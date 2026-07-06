'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createRoom, joinRoom } from '@/lib/rooms'

const AVATARS = [
  { emoji: '🕵️', color: '#C0392B' },
  { emoji: '🎭', color: '#C9A24B' },
  { emoji: '🦊', color: '#5A7A5E' },
  { emoji: '🐺', color: '#83808A' },
  { emoji: '🎩', color: '#4A6B8A' },
  { emoji: '👻', color: '#8A5A9A' },
  { emoji: '🃏', color: '#C0392B' },
  { emoji: '🔍', color: '#C9A24B' },
  { emoji: '🦉', color: '#5A7A5E' },
  { emoji: '🐍', color: '#4A6B8A' },
  { emoji: '🗝️', color: '#8A5A9A' },
  { emoji: '🕶️', color: '#83808A' },
]

export default function HomePage() {
  const router = useRouter()
  const [mode, setMode] = useState<'idle' | 'create' | 'join'>('idle')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [avatar, setAvatar] = useState(AVATARS[0].emoji)

  async function handleCreate() {
    if (!name.trim()) return setError('Enter your name')
    setLoading(true)
    setError('')
    try {
      const roomCode = await createRoom(name.trim(), avatar)
      router.push(`/lobby/${roomCode}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.')
      setLoading(false)
    }
  }

  async function handleJoin() {
    if (!name.trim()) return setError('Enter your name')
    if (!code.trim()) return setError('Enter a room code')
    setLoading(true)
    setError('')
    try {
      const roomCode = await joinRoom(code.trim(), name.trim(), avatar)
      router.push(`/lobby/${roomCode}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Room not found')
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-6">
      <svg width="56" height="56" viewBox="0 0 64 64">
        <rect width="64" height="64" rx="14" fill="#1D1E25" />
        <circle cx="27" cy="27" r="14" stroke="#C9A24B" strokeWidth="4" fill="none" />
        <line x1="37" y1="37" x2="48" y2="48" stroke="#C9A24B" strokeWidth="5" strokeLinecap="round" />
        <text x="27" y="33" fontFamily="monospace" fontSize="16" fill="#C0392B" textAnchor="middle" fontWeight="bold">?</text>
      </svg>

      <h1 className="text-5xl font-black tracking-wide text-evidence-gold">
        IMPOSTER
      </h1>

      {mode === 'idle' && (
        <div className="flex flex-col gap-4 w-full max-w-xs">
          <button
            onClick={() => setMode('create')}
            className="rounded-2xl bg-case-red px-6 py-4 font-bold text-paper"
          >
            Create Room
          </button>
          <button
            onClick={() => setMode('join')}
            className="rounded-2xl bg-surface px-6 py-4 font-bold text-paper border border-white/10"
          >
            Join Room
          </button>
        </div>
      )}

      {(mode === 'create' || mode === 'join') && (
        <div className="flex flex-col gap-4 w-full max-w-xs items-center">
          <div className="flex flex-col items-center gap-2">
            <span className="case-label">Choose your avatar</span>
            <div className="grid grid-cols-6 gap-2">
              {AVATARS.map((a) => (
                <button
                  key={a.emoji}
                  onClick={() => setAvatar(a.emoji)}
                  className="w-11 h-11 rounded-full flex items-center justify-center text-xl border-2 transition"
                  style={{
                    backgroundColor: avatar === a.emoji ? a.color : '#1D1E25',
                    borderColor: avatar === a.emoji ? a.color : 'rgba(255,255,255,0.1)',
                  }}
                >
                  {a.emoji}
                </button>
              ))}
            </div>
          </div>

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                mode === 'create' ? handleCreate() : handleJoin()
              }
            }}
            placeholder="Your name"
            className="w-full rounded-xl bg-surface px-4 py-3 text-paper outline-none border border-white/10 focus:border-evidence-gold"
          />
          {mode === 'join' && (
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleJoin()
              }}
              placeholder="Room code"
              maxLength={5}
              className="w-full rounded-xl bg-surface px-4 py-3 text-paper outline-none border border-white/10 focus:border-evidence-gold tracking-widest text-center uppercase"
            />
          )}
          {error && <p className="text-case-red text-sm">{error}</p>}
          <button
            onClick={mode === 'create' ? handleCreate : handleJoin}
            disabled={loading}
            className="w-full rounded-2xl bg-case-red px-6 py-4 font-bold text-paper disabled:opacity-50"
          >
            {loading ? 'Loading...' : mode === 'create' ? 'Create' : 'Join'}
          </button>
          <button
            onClick={() => { setMode('idle'); setError('') }}
            className="text-muted text-sm"
          >
            Back
          </button>
        </div>
      )}
    </main>
  )
}