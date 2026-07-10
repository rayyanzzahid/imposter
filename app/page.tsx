'use client'

import Image from 'next/image'
import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createRoom, joinRoom } from '@/lib/rooms'
import { SpyFigures } from '@/app/components/SpyFigures'

const AVATARS = [
  { src: '/avatars/detective1.png', name: 'Cipher', role: 'Detective', description: 'Calm reader. Good for careful players.' },
  { src: '/avatars/detective2.jpeg', name: 'Zing', role: 'Detective', description: 'Sharp eyes. Finds tiny lies.' },
  { src: '/avatars/detective3.png', name: 'Johnny', role: 'Detective', description: 'Quiet pressure. Lets others talk first.' },
  { src: '/avatars/detective4.png', name: 'Mira', role: 'Detective', description: 'Fast instincts. Spots strange answers early.' },
  { src: '/avatars/detective5.png', name: 'Rook', role: 'Detective', description: 'Hard to fool. Plays the long game.' },
  { src: '/avatars/detective6.png', name: 'Shade', role: 'Detective', description: 'Low profile. Watches every vote.' },
  { src: '/avatars/traitor1.jpeg', name: 'Ghost', role: 'Traitor', description: 'Silent operator. Perfect for bluffing.' },
  { src: '/avatars/traitor2.jpeg', name: 'Noir', role: 'Traitor', description: 'Smooth talker. Turns suspicion away.' },
  { src: '/avatars/traitor3.jpeg', name: 'Hex', role: 'Traitor', description: 'Makes weird answers sound normal.' },
  { src: '/avatars/traitor4.jpeg', name: 'Wraith', role: 'Traitor', description: 'Cold nerves. Survives under pressure.' },
  { src: '/avatars/traitor5.jpeg', name: 'Crow', role: 'Traitor', description: 'Lets the room accuse itself.' },
  { src: '/avatars/traitor6.jpeg', name: 'Silk', role: 'Traitor', description: 'Soft voice. Dangerous cover story.' },
]

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object') {
    try {
      return JSON.stringify(error)
    } catch {
      return fallback
    }
  }
  return error ? String(error) : fallback
}

export default function HomePage() {
  const router = useRouter()
  const [mode, setMode] = useState<'create' | 'join'>('create')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [avatar, setAvatar] = useState(AVATARS[0].src)
  const [hoveredAvatar, setHoveredAvatar] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate() {
    if (!name.trim()) return setError('Enter your name first')
    setLoading(true)
    setError('')

    try {
      const roomCode = await createRoom(name.trim(), avatar)
      router.push(`/lobby/${roomCode}`)
    } catch (e) {
      console.error('Create room failed', e)
      setError(errorMessage(e, 'Could not create room. Check Supabase setup.'))
      setLoading(false)
    }
  }

  async function handleJoin() {
    if (!name.trim()) return setError('Enter your name first')
    if (!code.trim()) return setError('Enter the room code')
    setLoading(true)
    setError('')

    try {
      const roomCode = await joinRoom(code.trim(), name.trim(), avatar)
      router.push(`/lobby/${roomCode}`)
    } catch (e) {
      console.error('Join room failed', e)
      setError(errorMessage(e, 'Could not join room. Check the code and try again.'))
      setLoading(false)
    }
  }

  function submitOnEnter(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    if (mode === 'create') handleCreate()
    else handleJoin()
  }

  return (
    <main className="spy-screen">
      <div className="screen-shadows" aria-hidden="true" />
      <section className="home-card">
        <p className="case-label">Classified party game</p>
        <h1 className="brand-title">Find The Traitor</h1>
        <p className="quiet-copy">Enter your name, create a room, and find the hidden traitor.</p>

        <SpyFigures />

        <div className="form-panel">
          <div className="mode-switch" role="tablist" aria-label="Room action">
            <button
              type="button"
              onClick={() => {
                setMode('create')
                setError('')
              }}
              data-active={mode === 'create'}
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('join')
                setError('')
              }}
              data-active={mode === 'join'}
            >
              Join
            </button>
          </div>

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={submitOnEnter}
            placeholder="Your name"
            className="spy-input"
            autoComplete="nickname"
          />

          {mode === 'join' && (
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={submitOnEnter}
              placeholder="Room code"
              maxLength={5}
              className="spy-input code-input"
              autoComplete="off"
            />
          )}

          <div className="avatar-picker" aria-label="Choose avatar">
            <span className="case-label">Choose avatar</span>
            <div className="avatar-grid">
              {AVATARS.map((item) => (
                <div
                  className="avatar-option"
                  data-hovered={hoveredAvatar === item.src}
                  key={item.src}
                  onMouseEnter={() => setHoveredAvatar(item.src)}
                  onMouseLeave={() => setHoveredAvatar((current) => current === item.src ? null : current)}
                >
                  <button
                    type="button"
                    className="agent-choice avatar-tile"
                    data-active={avatar === item.src}
                    aria-label={`Choose ${item.name}, ${item.role}`}
                    onClick={() => setAvatar(item.src)}
                  >
                    <span className="avatar-preview" aria-hidden="true">
                      <Image src={item.src} alt="" fill sizes="104px" className="avatar-image" unoptimized />
                    </span>
                  </button>
                  <span className="avatar-popover" aria-hidden="true">
                    <strong>{item.name}</strong>
                    <small>{item.role}</small>
                    <em>{item.description}</em>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="error-copy">{error}</p>}

          <button
            onClick={mode === 'create' ? handleCreate : handleJoin}
            disabled={loading}
            className="primary-action full"
          >
            {loading ? 'Preparing case...' : mode === 'create' ? 'Create Room' : 'Join Room'}
          </button>
        </div>
      </section>
    </main>
  )
}
