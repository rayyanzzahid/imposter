'use client'

import { useEffect, useRef, useState } from 'react'
import { getChatMessagesAction } from '@/app/actions/chat'
import { sendChatMessage } from '@/lib/chat'
import { createClient } from '@/lib/supabase/client'
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
  const [readMessageCount, setReadMessageCount] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const unreadCount = Math.max(messages.length - readMessageCount, 0)

  useEffect(() => {
    let active = true

    async function loadMessages() {
      const data = await getChatMessagesAction(roomId)
      if (active) setMessages(data)
    }

    const supabase = createClient()
    const channel = supabase
      .channel(`chat:${roomId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${roomId}` }, loadMessages)
      .subscribe()
    const timeout = window.setTimeout(loadMessages, 0)
    const fallbackInterval = window.setInterval(loadMessages, 5000)

    return () => {
      active = false
      window.clearTimeout(timeout)
      window.clearInterval(fallbackInterval)
      void supabase.removeChannel(channel)
    }
  }, [roomId])

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  useEffect(() => {
    if (!open) return
    const timeout = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => window.clearTimeout(timeout)
  }, [open])

  async function handleSend() {
    if (!me || !input.trim()) return
    const text = input
    const optimisticId = `optimistic-${Date.now()}`
    const optimisticMessage: ChatMessage = {
      id: optimisticId,
      room_id: roomId,
      player_id: me.id,
      text,
      created_at: new Date().toISOString(),
    }
    setInput('')
    setMessages((current) => [...current, optimisticMessage])

    try {
      await sendChatMessage(roomId, me.id, text)
      const data = await getChatMessagesAction(roomId)
      setMessages(data)
    } catch (error) {
      setMessages((current) => current.filter((message) => message.id !== optimisticId))
      console.error('Send chat message failed', error)
    }
  }

  function playerFor(id: string) {
    return players.find((player) => player.id === id)
  }

  if (!open) {
    return (
      <button onClick={() => { setReadMessageCount(messages.length); setOpen(true) }} className="chat-toggle" aria-label={unreadCount ? `Open chat, ${unreadCount} unread messages` : 'Open chat'}>
        <svg className="chat-icon" viewBox="0 0 48 48" aria-hidden="true">
          <path className="chat-icon-back" d="M27 9h8c5.5 0 10 4.5 10 10v9c0 4.2-2.6 7.8-6.3 9.3V44l-7.1-5H25c-5.5 0-10-4.5-10-10v-1" />
          <path className="chat-icon-front" d="M5 8.5C5 4.9 7.9 2 11.5 2h16C31.1 2 34 4.9 34 8.5v12c0 3.6-2.9 6.5-6.5 6.5H18l-8.5 7 1.8-7.1C7.7 26.2 5 23.5 5 20.5v-12Z" />
          <path className="chat-icon-line" d="M12 10.5h14M12 16h9" />
        </svg>
        {unreadCount > 0 && <span className="chat-unread" aria-label={`${unreadCount} unread messages`}>{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>
    )
  }

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <span className="case-label">Case chat</span>
        <button onClick={() => { setReadMessageCount(messages.length); setOpen(false) }} className="text-button">
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
          ref={inputRef}
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
