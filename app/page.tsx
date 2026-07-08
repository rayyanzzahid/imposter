'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createRoom, joinRoom } from '@/lib/rooms'
import { Logo } from '@/app/components/Logo'

const AVATARS = [
  '/avatars/detective1.png',
  '/avatars/detective2.jpeg',
  '/avatars/detective3.png',
  '/avatars/detective4.png',
  '/avatars/detective5.png',
  '/avatars/detective6.png',
  '/avatars/traitor1.jpeg',
  // add more paths here as you add files, e.g. '/avatars/detective2.png',
]

export default function HomePage() {
  const router = useRouter()
  const [mode, setMode] = useState<'idle' | 'create' | 'join'>('idle')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [avatar, setAvatar] = useState(AVATARS[0])

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
      <div className="flex flex-col items-center gap-4">
        <Logo size={64} />
        <h1 className="headline-stamp text-5xl font-bold" data-text="IMPOSTER">
          IMPOSTER
        </h1>
      </div>

      {mode === 'idle' && (
        <div className="fade-up flex flex-col gap-4 w-full max-w-xs">
          <button
            onClick={() => setMode('create')}
            className="rounded-2xl bg-case-red px-6 py-4 font-bold text-paper transition hover:brightness-110 active:scale-95"
          >
            Create Room
          </button>

          <button
            onClick={() => setMode('join')}
            className="rounded-2xl bg-surface px-6 py-4 font-bold text-paper border border-white/10 transition hover:border-white/20 active:scale-95"
          >
            Join Room
          </button>
        </div>
      )}

      {(mode === 'create' || mode === 'join') && (
        <div className="fade-up flex flex-col gap-4 w-full max-w-xs items-center">
          <div className="flex flex-col items-center gap-2">
            <span className="case-label">Choose your avatar</span>

            <div className="grid grid-cols-6 gap-2">
              {AVATARS.map((src, i) => (
                <button
                key={src}
                onClick={() => setAvatar(src)}
                data-active={avatar === src}
                className="avatar-tile"
              >
                <img src={src} alt="Avatar option" className="w-full h-full object-cover rounded-full" />
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
            className="w-full rounded-xl bg-surface px-4 py-3 text-paper outline-none border border-white/10 transition focus:border-evidence-gold"
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
              className="w-full rounded-xl bg-surface px-4 py-3 text-paper outline-none border border-white/10 transition focus:border-evidence-gold tracking-widest text-center uppercase"
            />
          )}

          {error && <p className="text-case-red text-sm">{error}</p>}

          <button
            onClick={mode === 'create' ? handleCreate : handleJoin}
            disabled={loading}
            className="w-full rounded-2xl bg-case-red px-6 py-4 font-bold text-paper transition hover:brightness-110 active:scale-95 disabled:opacity-50 disabled:active:scale-100"
          >
            {loading ? 'Loading...' : mode === 'create' ? 'Create' : 'Join'}
          </button>

          <button
            onClick={() => {
              setMode('idle')
              setError('')
            }}
            className="text-muted text-sm transition hover:text-paper"
          >
            Back
          </button>
        </div>
      )}
    </main>
  )
}