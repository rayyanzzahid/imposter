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

const INFO_TABS = [
  {
    id: 'rules',
    icon: '📜',
    label: 'Rules',
    title: 'Game Rules',
    content: (
      <>
        <p>
          Find The Traitor is built for quick online multiplayer rounds with friends. A host creates
          a room, shares the room code, and every player joins from the browser with a name and avatar.
        </p>
        <ul>
          <li>Minimum 3 players are required, but larger groups make the discussion more intense.</li>
          <li>At the start of each round, one random player secretly becomes the Traitor.</li>
          <li>Most players receive the same hidden topic or question.</li>
          <li>The Traitor receives a different prompt and must blend in without being exposed.</li>
          <li>Players answer by choosing another player, so every response becomes a clue.</li>
          <li>No one should reveal their exact question during the answer phase.</li>
          <li>After answers are revealed, the group discusses patterns, suspicious choices, and weak alibis.</li>
          <li>Everyone votes for the player they believe is the Traitor.</li>
          <li>If the majority identifies the Traitor, the team wins the round.</li>
          <li>If the Traitor survives the vote, the Traitor wins the round.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'game',
    icon: '🎯',
    label: 'Game',
    title: 'About Find The Traitor',
    content: (
      <>
        <p>
          Find The Traitor is an online multiplayer social deduction party game for people who like
          bluffing, reading reactions, debating clues, and catching the one player who does not belong.
        </p>
        <p>
          It plays like a fast browser-based spy game: one player secretly becomes the Traitor while
          everyone else shares the same hidden topic.
        </p>
        <p>
          Each round everyone answers a question, discusses the responses, and tries to identify who
          received the different prompt. Because answers are chosen from real players in the room,
          every choice can create suspicion, alliances, and misdirection.
        </p>
        <p>
          The game is designed for friends, family game nights, classrooms, parties, Discord calls,
          Zoom calls, and quick online sessions where nobody wants to download an app.
        </p>
        <p>
          Create a private room, share the code, choose an avatar, wait for everyone to ready up, and
          start playing. Rounds are short, easy to learn, and built around conversation instead of
          complicated controls.
        </p>
        <p>
          If you are searching for a dark spy-themed multiplayer game, an online party game with friends,
          a browser social deduction game, or a traitor/imposter game you can play instantly, Find The
          Traitor is made for that exact moment.
        </p>
      </>
    ),
  },
  {
    id: 'terms',
    icon: '📄',
    label: 'Terms',
    title: 'Terms & Fair Play',
    content: (
      <>
        <p>
          Find The Traitor works best when every player treats the room like a fair social deduction
          match. The fun comes from clever answers, calm suspicion, and good discussion.
        </p>
        <ul>
          <li>Be respectful to all players in every room.</li>
          <li>Do not intentionally spoil your assigned question or hidden prompt.</li>
          <li>Do not cheat by sharing screens, private messages, screenshots, or voice clues outside the game.</li>
          <li>Keep usernames and avatars appropriate for the group you are playing with.</li>
          <li>Hosts should start rounds only when the room is ready.</li>
          <li>The game is intended for entertainment, party play, and friendly competition.</li>
          <li>By playing you agree to follow community rules and play fairly.</li>
        </ul>
      </>
    ),
  },
] as const

type InfoTabId = (typeof INFO_TABS)[number]['id']

const GAME_STRUCTURED_DATA = {
  '@context': 'https://schema.org',
  '@type': 'VideoGame',
  name: 'Find The Traitor',
  alternateName: ['Find The Traitor Game', 'Find the Traitor Online'],
  description:
    'Find The Traitor is an online multiplayer social deduction party game where friends create private rooms, answer secret questions, discuss clues, vote, and reveal the hidden traitor.',
  genre: ['Social deduction', 'Party game', 'Multiplayer browser game', 'Spy game'],
  gamePlatform: ['Web browser', 'Desktop web', 'Mobile web'],
  applicationCategory: 'GameApplication',
  operatingSystem: 'Any',
  numberOfPlayers: {
    '@type': 'QuantitativeValue',
    minValue: 3,
  },
  playMode: 'MultiPlayer',
  keywords:
    'online multiplayer party game, social deduction game, spy game online, traitor game, browser party game, play with friends online',
} as const

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
  const [mode, setMode] = useState<'create' | 'join'>(() => {
    if (typeof window === 'undefined') return 'create'
    return new URLSearchParams(window.location.search).has('join') ? 'join' : 'create'
  })
  const [name, setName] = useState('')
  const [code, setCode] = useState(() => {
    if (typeof window === 'undefined') return ''
    return new URLSearchParams(window.location.search).get('join')?.toUpperCase() ?? ''
  })
  const [avatar, setAvatar] = useState(AVATARS[0].src)
  const [hoveredAvatar, setHoveredAvatar] = useState<string | null>(null)
  const [openInfoTab, setOpenInfoTab] = useState<InfoTabId | null>(null)
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(GAME_STRUCTURED_DATA) }}
      />
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

        <div className="intel-tabs" aria-label="Game information">
          <div className="intel-tab-bar" role="tablist" aria-label="Classified game dossier">
            {INFO_TABS.map((tab) => {
              const isActive = openInfoTab === tab.id

              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`intel-panel-${tab.id}`}
                  id={`intel-tab-${tab.id}`}
                  className="intel-tab"
                  data-active={isActive}
                  onClick={() => setOpenInfoTab((current) => current === tab.id ? null : tab.id)}
                >
                  <span aria-hidden="true">{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>

          <div className="intel-panels">
            {INFO_TABS.map((tab) => {
              const isOpen = openInfoTab === tab.id

              return (
                <section
                  key={tab.id}
                  id={`intel-panel-${tab.id}`}
                  className="intel-panel"
                  data-open={isOpen}
                  role="tabpanel"
                  aria-labelledby={`intel-tab-${tab.id}`}
                  aria-hidden={!isOpen}
                >
                  <div className="intel-panel-inner">
                    <span className="intel-rule" aria-hidden="true" />
                    <h2>{tab.title}</h2>
                    <div className="intel-copy">{tab.content}</div>
                  </div>
                </section>
              )
            })}
          </div>
        </div>
      </section>
    </main>
  )
}
