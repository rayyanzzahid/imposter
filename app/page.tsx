'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createRoom, joinRoom } from '@/lib/rooms'

export default function HomePage() {
  const router = useRouter()
  const [mode, setMode] = useState<'idle' | 'create' | 'join'>('idle')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate() {
    if (!name.trim()) return setError('Enter your name')
    setLoading(true)
    setError('')
    try {
      const roomCode = await createRoom(name.trim())
      router.push(`/lobby/${roomCode}`)
    } catch (e) {
      setError('Something went wrong. Try again.')
      setLoading(false)
    }
  }

  async function handleJoin() {
    if (!name.trim()) return setError('Enter your name')
    if (!code.trim()) return setError('Enter a room code')
    setLoading(true)
    setError('')
    try {
      const roomCode = await joinRoom(code.trim(), name.trim())
      router.push(`/lobby/${roomCode}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Room not found')
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-6">
      <h1 className="text-5xl font-black tracking-wide text-neon-purple">
        IMPOSTER
      </h1>

      {mode === 'idle' && (
        <div className="flex flex-col gap-4 w-full max-w-xs">
          <button
            onClick={() => setMode('create')}
            className="rounded-2xl bg-neon-purple px-6 py-4 font-bold text-white"
          >
            Create Room
          </button>
          <button
            onClick={() => setMode('join')}
            className="rounded-2xl bg-surface px-6 py-4 font-bold text-white border border-white/10"
          >
            Join Room
          </button>
        </div>
      )}

      {(mode === 'create' || mode === 'join') && (
        <div className="flex flex-col gap-4 w-full max-w-xs">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="rounded-xl bg-surface px-4 py-3 text-white outline-none border border-white/10 focus:border-neon-purple"
          />
          {mode === 'join' && (
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Room code"
              maxLength={5}
              className="rounded-xl bg-surface px-4 py-3 text-white outline-none border border-white/10 focus:border-neon-purple tracking-widest text-center uppercase"
            />
          )}
          {error && <p className="text-danger text-sm">{error}</p>}
          <button
            onClick={mode === 'create' ? handleCreate : handleJoin}
            disabled={loading}
            className="rounded-2xl bg-neon-purple px-6 py-4 font-bold text-white disabled:opacity-50"
          >
            {loading ? 'Loading...' : mode === 'create' ? 'Create' : 'Join'}
          </button>
          <button
            onClick={() => { setMode('idle'); setError('') }}
            className="text-zinc-400 text-sm"
          >
            Back
          </button>
        </div>
      )}
    </main>
  )
}