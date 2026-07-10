'use client'

import { useEffect, useRef, useState } from 'react'
import { getChatMessagesAction } from '@/app/actions/chat'
import { sendChatMessage } from '@/lib/chat'
import type { Player, ChatMessage } from '@/lib/supabase/types'

export default function Chat({
  roomId,
  me,
  players,
}: {
  roomId: string
  me: Player | null
  players: Player[]
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true

    async function loadMessages() {
      const data = await getChatMessagesAction(roomId)
      if (active) setMessages(data)
    }

    const timeout = window.setTimeout(loadMessages, 0)
    const interval = window.setInterval(loadMessages, 1800)

    return () => {
      active = false
      window.clearTimeout(timeout)
      window.clearInterval(interval)
    }
  }, [roomId])

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  async function handleSend() {
    if (!me || !input.trim()) return
    const text = input
    setInput('')
    await sendChatMessage(roomId, me.id, text)
    const data = await getChatMessagesAction(roomId)
    setMessages(data)
  }

  function playerFor(id: string) {
    return players.find((player) => player.id === id)
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="chat-toggle" aria-label="Open chat">
        Chat
      </button>
    )
  }

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <span className="case-label">Case chat</span>
        <button onClick={() => setOpen(false)} className="text-button">
          Close
        </button>
      </div>

      <div className="chat-messages">
        {messages.map((message) => {
          const sender = playerFor(message.player_id)
          const isMe = message.player_id === me?.id
          return (
            <div key={message.id} className={`chat-bubble ${isMe ? 'mine' : 'other'}`}>
              {!isMe && <p className="case-label mb-1">{sender?.name ?? 'Unknown'}</p>}
              <p>{message.text}</p>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div className="chat-compose">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSend()
          }}
          placeholder="Say something..."
          maxLength={300}
          className="spy-input chat-input"
        />
        <button onClick={handleSend} className="mini-action">
          Send
        </button>
      </div>
    </div>
  )
}
