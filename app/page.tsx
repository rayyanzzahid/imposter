'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createRoom, joinRoom } from '@/lib/rooms'
import { uploadAvatar } from '@/lib/avatars'

export default function HomePage() {
  const router = useRouter()
  const [mode, setMode] = useState<'idle' | 'create' | 'join'>('idle')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)

  async function handleCreate() {
    if (!name.trim()) return setError('Enter your name')
    setLoading(true)
    setError('')
    try {
      const avatarUrl = avatarFile ? await uploadAvatar(avatarFile) : null
      const roomCode = await createRoom(name.trim(), avatarUrl)
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
      const avatarUrl = avatarFile ? await uploadAvatar(avatarFile) : null
      const roomCode = await joinRoom(code.trim(), name.trim(), avatarUrl)
      router.push(`/lobby/${roomCode}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Room not found')
      setLoading(false)
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      setAvatarFile(file)
      setAvatarPreview(URL.createObjectURL(file))
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
            <label className="cursor-pointer">
              <div className="w-20 h-20 rounded-full bg-surface border-2 border-white/10 flex items-center justify-center overflow-hidden">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Your avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl">📷</span>
                )}
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </label>
            <span className="text-muted text-xs">Tap to add a photo</span>
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