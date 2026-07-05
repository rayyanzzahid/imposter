'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getSessionId } from '@/lib/session'
import { submitAnswer } from '@/lib/answers'
import { submitVote } from '@/lib/votes'
import { markSkipDiscussion } from '@/lib/rounds'
import {
  advanceToDiscussion,
  advanceToVoting,
  advanceToQuestionReveal,
  advanceToReveal,
  startRound,
  endGame,
  resetGame,
} from '@/app/actions/game'
import type { Room, Player, Round, Question, Answer, Vote } from '@/lib/supabase/types'

export default function GameRoom({ room }: { room: Room }) {
  const supabase = createClient()
  const router = useRouter()
  const sessionId = getSessionId()
  const [round, setRound] = useState<Round | null>(null)
  const [question, setQuestion] = useState<Question | null>(null)
  const [mainQuestion, setMainQuestion] = useState<Question | null>(null)
  const [me, setMe] = useState<Player | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [answers, setAnswers] = useState<Answer[]>([])
  const [votes, setVotes] = useState<Vote[]>([])
  const [skips, setSkips] = useState<string[]>([])
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [roomStatus, setRoomStatus] = useState(room.status)
  const [totalRounds, setTotalRounds] = useState(room.total_rounds)
  const [autoAdvanceIn, setAutoAdvanceIn] = useState(5)
  const advancing = useRef(false)
  const nextRoundStarting = useRef(false)

  async function loadAll() {
    const { data: currentRoom } = await supabase
      .from('rooms')
      .select('status, total_rounds')
      .eq('id', room.id)
      .single()

    const { data: rounds } = await supabase
      .from('rounds')
      .select()
      .eq('room_id', room.id)
      .order('round_number', { ascending: false })
      .limit(1)
    const currentRound = rounds?.[0] ?? null

    const { data: allPlayers } = await supabase
      .from('players')
      .select()
      .eq('room_id', room.id)
      .order('created_at', { ascending: true })

    const player = allPlayers?.find((p) => p.session_id === sessionId) ?? null

    let newQuestion: Question | null = null
    let newMainQuestion: Question | null = null
    let newAnswers: Answer[] = []
    let newVotes: Vote[] = []
    let newSkips: string[] = []

    if (currentRound && player) {
      const isImposter = currentRound.imposter_player_id === player.id
      const myQuestionId = isImposter ? currentRound.imposter_question_id : currentRound.question_id

      const [qRes, mqRes, answersRes, votesRes, skipsRes] = await Promise.all([
        supabase.from('questions').select().eq('id', myQuestionId).single(),
        supabase.from('questions').select().eq('id', currentRound.question_id).single(),
        supabase.from('answers').select().eq('round_id', currentRound.id),
        supabase.from('votes').select().eq('round_id', currentRound.id),
        supabase.from('discussion_skips').select('player_id').eq('round_id', currentRound.id),
      ])

      newQuestion = qRes.data
      newMainQuestion = mqRes.data
      newAnswers = answersRes.data ?? []
      newVotes = votesRes.data ?? []
      newSkips = (skipsRes.data ?? []).map((s) => s.player_id)
    }

    if (currentRoom) {
      setRoomStatus(currentRoom.status)
      setTotalRounds(currentRoom.total_rounds)
    }
    setRound(currentRound)
    if (allPlayers) setPlayers(allPlayers)
    setMe(player)
    setQuestion(newQuestion)
    setMainQuestion(newMainQuestion)
    setAnswers(newAnswers)
    setVotes(newVotes)
    setSkips(newSkips)
  }

  useEffect(() => {
    loadAll()

    const channel = supabase
      .channel(`game-${room.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rounds', filter: `room_id=eq.${room.id}` }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${room.id}` }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'answers' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'votes' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'discussion_skips' }, loadAll)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` },
        (payload) => {
          loadAll()
          if (payload.new.status === 'lobby') {
            router.push(`/lobby/${room.code}`)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id, sessionId])

  useEffect(() => {
    advancing.current = false
    nextRoundStarting.current = false
  }, [round?.id, round?.phase])

  const allAnswered = players.length > 0 && players.every((p) => answers.some((a) => a.player_id === p.id))
  const allVoted = players.length > 0 && players.every((p) => votes.some((v) => v.voter_id === p.id))
  const isHost = me?.is_host ?? false

  // answering -> question_reveal, once everyone's answered
  useEffect(() => {
    if (round?.phase === 'answering' && allAnswered && isHost && !advancing.current) {
      advancing.current = true
      advanceToQuestionReveal(round.id)
    }
  }, [round?.phase, allAnswered, isHost, round?.id])

  // question_reveal -> discussion, after a short pause
  useEffect(() => {
    if (round?.phase === 'question_reveal' && isHost && !advancing.current) {
      advancing.current = true
      const timeout = setTimeout(() => {
        advanceToDiscussion(round.id)
      }, 12000)
      return () => clearTimeout(timeout)
    }
  }, [round?.phase, isHost, round?.id])

  // discussion countdown -> voting (auto, or immediately if everyone skips)
  useEffect(() => {
    if (round?.phase !== 'discussion' || !round.discussion_ends_at) return

    const allSkipped = players.length > 0 && players.every((p) => skips.includes(p.id))
    if (allSkipped && isHost && !advancing.current) {
      advancing.current = true
      advanceToVoting(round.id)
      return
    }

    const interval = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.ceil((new Date(round.discussion_ends_at!).getTime() - Date.now()) / 1000)
      )
      setSecondsLeft(remaining)
      if (remaining === 0) {
        clearInterval(interval)
        if (isHost && !advancing.current) {
          advancing.current = true
          advanceToVoting(round.id)
        }
      }
    }, 500)
    return () => clearInterval(interval)
  }, [round?.phase, round?.discussion_ends_at, isHost, round?.id, players, skips])

  // voting -> reveal, once everyone's voted
  useEffect(() => {
    if (round?.phase === 'voting' && allVoted && isHost && !advancing.current) {
      advancing.current = true
      advanceToReveal(round.id)
    }
  }, [round?.phase, allVoted, isHost, round?.id])

  // reveal -> auto Next Round / End Game after 5s if host doesn't click manually
  useEffect(() => {
    if (round?.phase !== 'reveal' || !isHost) return
    setAutoAdvanceIn(5)
    const countdown = setInterval(() => {
      setAutoAdvanceIn((s) => Math.max(0, s - 1))
    }, 1000)
    const timeout = setTimeout(() => {
      if (!nextRoundStarting.current) {
        nextRoundStarting.current = true
        const isLastRound = round.round_number >= totalRounds
        if (isLastRound) {
          endGame(room.id)
        } else {
          startRound(room.id)
        }
      }
    }, 5000)
    return () => {
      clearInterval(countdown)
      clearTimeout(timeout)
    }
  }, [round?.phase, round?.id, isHost, totalRounds])

  if (!round || !me || !question) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-zinc-400">Loading round...</p>
      </main>
    )
  }

  if (roomStatus === 'ended') {
    async function handlePlayAgain() {
      await resetGame(room.id)
      router.push(`/lobby/${room.code}`)
    }

    return (
      <main className="flex min-h-screen flex-col items-center gap-6 px-6 py-12 text-center">
        <h1 className="text-3xl font-black text-neon-purple">Game Over!</h1>
        <div className="w-full max-w-sm flex flex-col gap-2 mt-6">
          {[...players].sort((a, b) => b.score - a.score).map((p, i) => (
            <div
              key={p.id}
              className={`flex justify-between rounded-xl px-4 py-3 border ${
                i === 0 ? 'bg-neon-purple/20 border-neon-purple' : 'bg-surface border-white/10'
              }`}
            >
              <span className="text-white font-medium">
                {i === 0 && '🏆 '}{p.name}
              </span>
              <span className="text-neon-purple font-bold">{p.score} pts</span>
            </div>
          ))}
        </div>

        <div className="w-full max-w-sm flex flex-col gap-3 mt-6">
          {isHost && (
            <button
              onClick={handlePlayAgain}
              className="rounded-2xl bg-neon-purple px-6 py-4 font-bold text-white"
            >
              Stay &amp; Play Again
            </button>
          )}
          <a href="/" className="text-zinc-400 text-sm">Back to Home</a>
        </div>
      </main>
    )
  }

  const myAnswer = answers.find((a) => a.player_id === me.id)
  const myVote = votes.find((v) => v.voter_id === me.id)
  const iSkipped = skips.includes(me.id)

  async function handleAnswer(answeredPlayer: Player) {
    if (myAnswer) return
    await submitAnswer(round!.id, me!.id, answeredPlayer.id, answeredPlayer.name)
  }

  async function handleVote(votedForId: string) {
    if (myVote) return
    await submitVote(round!.id, me!.id, votedForId)
  }

  async function handleSkip() {
    if (iSkipped) return
    await markSkipDiscussion(round!.id, me!.id)
  }

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 px-6 py-12 text-center">
      <p className="text-zinc-500 text-sm">Round {round.round_number}</p>

      {round.phase === 'answering' && (
        <>
          <h1 className="text-2xl font-bold text-white">Your Question</h1>
          <p className="text-3xl font-black text-neon-purple max-w-sm">{question.text}</p>

          {!myAnswer ? (
            <div className="w-full max-w-sm flex flex-col gap-3 mt-4">
              {players.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleAnswer(p)}
                  className="rounded-xl bg-surface px-4 py-4 font-medium text-white border border-white/10"
                >
                  {p.name}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-zinc-400 mt-4">
              Waiting for others ({answers.length}/{players.length} answered)...
            </p>
          )}
        </>
      )}

      {round.phase === 'question_reveal' && (
        <>
          {round.imposter_player_id === me.id && (
            <div className="bg-danger/20 border border-danger rounded-xl px-4 py-3 max-w-sm">
              <p className="text-danger font-bold">You were the Imposter!</p>
              <p className="text-zinc-300 text-sm mt-1">
                You answered a different question. Try to blend in during discussion.
              </p>
            </div>
          )}

          <h1 className="text-2xl font-bold text-white">The Real Question Was...</h1>
          <p className="text-3xl font-black text-neon-purple max-w-sm">
            {mainQuestion?.text}
          </p>
          <p className="text-zinc-400 mt-2">Look back at everyone&apos;s answers. Who seems off?</p>

          <div className="w-full max-w-sm flex flex-col gap-2 mt-6">
            {players.map((p) => {
              const a = answers.find((a) => a.player_id === p.id)
              return (
                <div key={p.id} className="flex justify-between rounded-xl bg-surface px-4 py-3 border border-white/10">
                  <span className="text-white">{p.name}</span>
                  <span className="text-zinc-400">{a?.text ?? '...'}</span>
                </div>
              )
            })}
          </div>
        </>
      )}

      {round.phase === 'discussion' && (
        <>
          <h1 className="text-2xl font-bold text-white">Discuss!</h1>
          <p className="text-5xl font-black text-neon-purple">{secondsLeft}s</p>
          <p className="text-zinc-400">Talk it out. Who do you think is the Imposter?</p>

          <button
            onClick={handleSkip}
            disabled={iSkipped}
            className="rounded-2xl bg-surface px-6 py-4 font-bold text-white border border-white/10 disabled:opacity-40 mt-4"
          >
            {iSkipped ? `Waiting for others (${skips.length}/${players.length})...` : 'Skip Discussion'}
          </button>
        </>
      )}

      {round.phase === 'voting' && (
        <>
          <h1 className="text-2xl font-bold text-white">Who is the Imposter?</h1>

          <div className="w-full max-w-sm flex flex-col gap-3 mt-4">
            {players.map((p) => (
              <button
                key={p.id}
                onClick={() => handleVote(p.id)}
                disabled={!!myVote}
                className={`rounded-xl px-4 py-4 font-medium border transition ${
                  myVote?.voted_for_id === p.id
                    ? 'bg-neon-purple border-neon-purple text-white'
                    : 'bg-surface border-white/10 text-white disabled:opacity-40'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>

          <p className="text-zinc-400 mt-4">
            {myVote
              ? `Waiting for others (${votes.length}/${players.length} voted)...`
              : 'Tap a player to vote'}
          </p>
        </>
      )}

      {round.phase === 'reveal' && (() => {
        const imposter = players.find((p) => p.id === round.imposter_player_id)
        const tally: Record<string, number> = {}
        for (const v of votes) {
          tally[v.voted_for_id] = (tally[v.voted_for_id] ?? 0) + 1
        }
        const maxVotes = Math.max(0, ...Object.values(tally))
        const topVoted = Object.entries(tally).filter(([, c]) => c === maxVotes).map(([id]) => id)
        const imposterCaught = topVoted.length === 1 && topVoted[0] === round.imposter_player_id
        const isLastRound = round.round_number >= totalRounds

        async function handleNextOrEnd() {
          if (nextRoundStarting.current) return
          nextRoundStarting.current = true
          if (isLastRound) {
            await endGame(room.id)
          } else {
            await startRound(room.id)
          }
        }

        return (
          <>
            <div className={`stamp ${imposterCaught ? '' : 'border-stamp-green text-stamp-green'}`}>
              {imposterCaught ? 'Case Closed' : 'Suspect Escaped'}
            </div>
            <p className="text-xl text-white mt-2">
              The Imposter was <span className="text-neon-purple font-bold">{imposter?.name}</span>
            </p>

            <div className="w-full max-w-sm flex flex-col gap-2 mt-6">
              <p className="text-zinc-400 text-sm text-left">Vote breakdown</p>
              {players.map((p) => (
                <div key={p.id} className="flex justify-between rounded-xl bg-surface px-4 py-3 border border-white/10">
                  <span className="text-white">{p.name}</span>
                  <span className="text-zinc-400">{tally[p.id] ?? 0} votes</span>
                </div>
              ))}
            </div>

            <div className="w-full max-w-sm flex flex-col gap-2 mt-6">
              <p className="text-zinc-400 text-sm text-left">Scoreboard</p>
              {[...players].sort((a, b) => b.score - a.score).map((p) => (
                <div key={p.id} className="flex justify-between rounded-xl bg-surface px-4 py-3 border border-white/10">
                  <span className="text-white">{p.name}</span>
                  <span className="text-neon-purple font-bold">{p.score} pts</span>
                </div>
              ))}
            </div>

            {isHost && (
              <button
                onClick={handleNextOrEnd}
                className="rounded-2xl bg-neon-purple px-6 py-4 font-bold text-white mt-6 w-full max-w-sm"
              >
                {isLastRound ? 'End Game' : 'Next Round'} ({autoAdvanceIn}s)
              </button>
            )}
          </>
        )
      })()}
    </main>
  )
}