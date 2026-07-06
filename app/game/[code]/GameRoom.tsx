'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getUserId } from '@/lib/auth'
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

function Avatar({ emoji }: { emoji: string }) {
  return (
    <div className="w-8 h-8 rounded-full bg-surface border border-white/10 flex items-center justify-center shrink-0 text-sm">
      {emoji}
    </div>
  )
}

export default function GameRoom({ room }: { room: Room }) {
  const supabase = createClient()
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [round, setRound] = useState<Round | null>(null)
  const [question, setQuestion] = useState<Question | null>(null)
  const [mainQuestion, setMainQuestion] = useState<Question | null>(null)
  const [imposterQuestion, setImposterQuestion] = useState<Question | null>(null)
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

  useEffect(() => {
    getUserId().then(setUserId)
  }, [])

  async function loadAll() {
    if (!userId) return

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

    const player = allPlayers?.find((p) => p.user_id === userId) ?? null

    let newQuestion: Question | null = null
    let newMainQuestion: Question | null = null
    let newImposterQuestion: Question | null = null
    let newAnswers: Answer[] = []
    let newVotes: Vote[] = []
    let newSkips: string[] = []

    if (currentRound && player) {
      const isImposter = currentRound.imposter_player_id === player.id
      const myQuestionId = isImposter ? currentRound.imposter_question_id : currentRound.question_id

      const [qRes, mqRes, iqRes, answersRes, votesRes, skipsRes] = await Promise.all([
        supabase.from('questions').select().eq('id', myQuestionId).single(),
        supabase.from('questions').select().eq('id', currentRound.question_id).single(),
        supabase.from('questions').select().eq('id', currentRound.imposter_question_id).single(),
        supabase.from('answers').select().eq('round_id', currentRound.id),
        supabase.from('votes').select().eq('round_id', currentRound.id),
        supabase.from('discussion_skips').select('player_id').eq('round_id', currentRound.id),
      ])

      newQuestion = qRes.data
      newMainQuestion = mqRes.data
      newImposterQuestion = iqRes.data
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
    setImposterQuestion(newImposterQuestion)
    setAnswers(newAnswers)
    setVotes(newVotes)
    setSkips(newSkips)
  }

  useEffect(() => {
    if (!userId) return
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
  }, [room.id, userId])

  useEffect(() => {
    advancing.current = false
    nextRoundStarting.current = false
  }, [round?.id, round?.phase])

  const allAnswered = players.length > 0 && players.every((p) => answers.some((a) => a.player_id === p.id))
  const allVoted = players.length > 0 && players.every((p) => votes.some((v) => v.voter_id === p.id))
  const isHost = me?.is_host ?? false

  useEffect(() => {
    if (round?.phase === 'answering' && allAnswered && isHost && !advancing.current) {
      advancing.current = true
      advanceToQuestionReveal(round.id)
    }
  }, [round?.phase, allAnswered, isHost, round?.id])

  useEffect(() => {
    if (round?.phase === 'question_reveal' && isHost && !advancing.current) {
      advancing.current = true
      const timeout = setTimeout(() => {
        advanceToDiscussion(round.id)
      }, 12000)
      return () => clearTimeout(timeout)
    }
  }, [round?.phase, isHost, round?.id])

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

  useEffect(() => {
    if (round?.phase === 'voting' && allVoted && isHost && !advancing.current) {
      advancing.current = true
      advanceToReveal(round.id)
    }
  }, [round?.phase, allVoted, isHost, round?.id])

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
        <p className="text-muted">Loading round...</p>
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
        <h1 className="text-3xl font-black text-evidence-gold">Case Closed — Final Report</h1>
        <div className="w-full max-w-sm flex flex-col gap-2 mt-6">
          {[...players].sort((a, b) => b.score - a.score).map((p, i) => (
            <div
              key={p.id}
              className={`flex justify-between items-center rounded-xl px-4 py-3 border ${
                i === 0 ? 'bg-evidence-gold/20 border-evidence-gold' : 'bg-surface border-white/10'
              }`}
            >
              <div className="flex items-center gap-2">
                <Avatar emoji={p.avatar_url} />
                <span className="text-paper font-medium">
                  {i === 0 && '🏆 '}{p.name}
                </span>
              </div>
              <span className="text-evidence-gold font-bold">{p.score} pts</span>
            </div>
          ))}
        </div>

        <div className="w-full max-w-sm flex flex-col gap-3 mt-6">
          {isHost && (
            <button
              onClick={handlePlayAgain}
              className="rounded-2xl bg-case-red px-6 py-4 font-bold text-paper"
            >
              Stay &amp; Play Again
            </button>
          )}
          <a href="/" className="text-muted text-sm">Back to Home</a>
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
    await submitVote(round!.id, me!.id, votedForId)
  }

  async function handleSkip() {
    if (iSkipped) return
    await markSkipDiscussion(round!.id, me!.id)
  }

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 px-6 py-12 text-center">
      <p className="case-label">Round {round.round_number}</p>

      {round.phase === 'answering' && (
        <>
          <h1 className="text-2xl font-bold text-paper">Your Question</h1>
          <p className="text-3xl font-black text-evidence-gold max-w-sm">{question.text}</p>

          {!myAnswer ? (
            <div className="w-full max-w-sm flex flex-col gap-3 mt-4">
              {players.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleAnswer(p)}
                  className="flex items-center gap-3 rounded-xl bg-surface px-4 py-4 font-medium text-paper border border-white/10"
                >
                  <Avatar emoji={p.avatar_url} />
                  {p.name}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-muted mt-4">
              Waiting for others ({answers.length}/{players.length} answered)...
            </p>
          )}
        </>
      )}

      {round.phase === 'question_reveal' && (
        <>
          {round.imposter_player_id === me.id && (
            <div className="bg-case-red/20 border border-case-red rounded-xl px-4 py-3 max-w-sm">
              <p className="text-case-red font-bold">You were the Imposter!</p>
              <p className="text-paper/80 text-sm mt-1">
                You answered a different question. Try to blend in during discussion.
              </p>
            </div>
          )}

          <h1 className="text-2xl font-bold text-paper">The Real Question Was...</h1>
          <p className="text-3xl font-black text-evidence-gold max-w-sm">
            {mainQuestion?.text}
          </p>
          <p className="text-muted mt-2">Look back at everyone&apos;s answers. Who seems off?</p>

          <div className="w-full max-w-sm flex flex-col gap-2 mt-6">
            {players.map((p) => {
              const a = answers.find((a) => a.player_id === p.id)
              return (
                <div key={p.id} className="flex items-center justify-between rounded-xl bg-surface px-4 py-3 border border-white/10">
                  <div className="flex items-center gap-2">
                    <Avatar emoji={p.avatar_url} />
                    <span className="text-paper">{p.name}</span>
                  </div>
                  <span className="text-muted">{a?.text ?? '...'}</span>
                </div>
              )
            })}
          </div>
        </>
      )}

      {round.phase === 'discussion' && (
        <>
          <h1 className="text-2xl font-bold text-paper">Discuss!</h1>
          <p className="text-5xl font-black text-evidence-gold" style={{ fontFamily: 'var(--font-mono)' }}>
            {secondsLeft}s
          </p>
          <p className="text-muted">Talk it out. Who do you think is the Imposter?</p>

          <button
            onClick={handleSkip}
            disabled={iSkipped}
            className="rounded-2xl bg-surface px-6 py-4 font-bold text-paper border border-white/10 disabled:opacity-40 mt-4"
          >
            {iSkipped ? `Waiting for others (${skips.length}/${players.length})...` : 'Skip Discussion'}
          </button>
        </>
      )}

      {round.phase === 'voting' && (() => {
        const votingLocked = allVoted

        return (
          <>
            <h1 className="text-2xl font-bold text-paper">Who is the Imposter?</h1>

            <div className="w-full max-w-sm flex flex-col gap-3 mt-4">
              {players.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleVote(p.id)}
                  disabled={votingLocked}
                  className={`flex items-center gap-3 rounded-xl px-4 py-4 font-medium border transition ${
                    myVote?.voted_for_id === p.id
                      ? 'bg-case-red border-case-red text-paper'
                      : 'bg-surface border-white/10 text-paper disabled:opacity-40'
                  }`}
                >
                  <Avatar emoji={p.avatar_url} />
                  {p.name}
                </button>
              ))}
            </div>

            <p className="text-muted mt-4">
              {votingLocked
                ? 'Everyone has voted!'
                : myVote
                  ? `Vote locked in — tap another name to change it (${votes.length}/${players.length} voted)`
                  : 'Tap a player to vote'}
            </p>
          </>
        )
      })()}

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
            <div className="flex items-center gap-2 mt-2">
              <Avatar emoji={imposter?.avatar_url ?? '🕵️'} />
              <p className="text-xl text-paper">
                The Imposter was <span className="text-evidence-gold font-bold">{imposter?.name}</span>
              </p>
            </div>

            <div className="w-full max-w-sm flex flex-col gap-2 mt-6">
              <p className="case-label text-left">Vote Breakdown</p>
              {players.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-xl bg-surface px-4 py-3 border border-white/10">
                  <div className="flex items-center gap-2">
                    <Avatar emoji={p.avatar_url} />
                    <span className="text-paper">{p.name}</span>
                  </div>
                  <span className="text-muted">{tally[p.id] ?? 0} votes</span>
                </div>
              ))}
            </div>

            <div className="w-full max-w-sm mt-6">
              <p className="case-label text-left mb-2">The Imposter&apos;s Question Was</p>
              <p className="text-2xl font-black text-case-red">{imposterQuestion?.text}</p>
            </div>

            <div className="w-full max-w-sm flex flex-col gap-2 mt-6">
              <p className="case-label text-left">Scoreboard</p>
              {[...players].sort((a, b) => b.score - a.score).map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-xl bg-surface px-4 py-3 border border-white/10">
                  <div className="flex items-center gap-2">
                    <Avatar emoji={p.avatar_url} />
                    <span className="text-paper">{p.name}</span>
                  </div>
                  <span className="text-evidence-gold font-bold">{p.score} pts</span>
                </div>
              ))}
            </div>

            {isHost && (
              <button
                onClick={handleNextOrEnd}
                className="rounded-2xl bg-case-red px-6 py-4 font-bold text-paper mt-6 w-full max-w-sm"
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