'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
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
  const supabase = createClient()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('chat_messages')
        .select()
        .eq('room_id', roomId)
        .order('created_at', { ascending: true })
        .limit(200)
      if (data) setMessages(data)
    }
    load()

    const channel = supabase
      .channel(`chat-${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${roomId}` },
        (payload) => setMessages((prev) => [...prev, payload.new as ChatMessage])
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomId, supabase])

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  async function handleSend() {
    if (!me || !input.trim()) return
    const text = input
    setInput('')
    await sendChatMessage(roomId, me.id, text)
  }

  function playerFor(id: string) {
    return players.find((p) => p.id === id)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 rounded-full bg-case-red w-14 h-14 flex items-center justify-center text-2xl shadow-lg z-40"
      >
        💬
      </button>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 w-80 max-w-[90vw] h-96 bg-surface border border-white/10 rounded-2xl flex flex-col z-40 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <span className="case-label">Case Chat</span>
        <button onClick={() => setOpen(false)} className="text-muted text-sm">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-2">
        {messages.map((m) => {
          const sender = playerFor(m.player_id)
          const isMe = m.player_id === me?.id
          return (
            <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${
                  isMe ? 'bg-case-red text-paper' : 'bg-surface-elevated text-paper border border-white/10'
                }`}
              >
                {!isMe && (
                  <p className="text-xs text-muted mb-0.5">
                    {sender?.avatar ?? '🕵️'} {sender?.name ?? 'Unknown'}
                  </p>
                )}
                <p>{m.text}</p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 p-3 border-t border-white/10">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSend() }}
          placeholder="Say something..."
          maxLength={300}
          className="flex-1 rounded-lg bg-background px-3 py-2 text-paper text-sm outline-none border border-white/10 focus:border-evidence-gold"
        />
        <button
          onClick={handleSend}
          className="rounded-lg bg-case-red px-3 py-2 text-sm font-bold text-paper"
        >
          Send
        </button>
      </div>
    </div>
  )
}