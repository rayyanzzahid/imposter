'use client'

import { useEffect, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getRoomPlayerId, getUserId } from '@/lib/auth'
import { createClient } from '@/lib/supabase/client'
import { submitAnswer } from '@/lib/answers'
import { submitVote } from '@/lib/votes'
import { markSkipDiscussion } from '@/lib/rounds'
import { getGameStateAction } from '@/app/actions/game-state'
import {
  advanceToDiscussion,
  advanceToVoting,
  advanceToQuestionReveal,
  advanceToReveal,
  startRound,
  endGame,
  resetGame,
} from '@/app/actions/game'
import { AvatarBadge } from '@/app/components/AvatarBadge'
import type { Room, Player, Round, Question, Answer, Vote } from '@/lib/supabase/types'
import Chat from '@/components/Chat'

export default function GameRoom({ room }: { room: Room }) {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [roomPlayerId, setRoomPlayerId] = useState<string | null>(null)
  const [round, setRound] = useState<Round | null>(null)
  const [question, setQuestion] = useState<Question | null>(null)
  const [mainQuestion, setMainQuestion] = useState<Question | null>(null)
  const [imposterQuestion, setImposterQuestion] = useState<Question | null>(null)
  const [isTraitor, setIsTraitor] = useState(false)
  const [me, setMe] = useState<Player | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [answers, setAnswers] = useState<Answer[]>([])
  const [votes, setVotes] = useState<Vote[]>([])
  const [skips, setSkips] = useState<string[]>([])
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [roomStatus, setRoomStatus] = useState(room.status)
  const [totalRounds, setTotalRounds] = useState(room.total_rounds)
  const [pendingSubmission, setPendingSubmission] = useState(false)
  const pendingSubmissionRef = useRef(false)
  const optimisticAnswerRef = useRef<Answer | null>(null)
  const optimisticVoteRef = useRef<Vote | null>(null)
  const optimisticSkipRef = useRef<string | null>(null)
  const advancing = useRef(false)
  const nextRoundStarting = useRef(false)
  const refreshTimer = useRef<number | null>(null)

  useEffect(() => {
    getUserId().then(setUserId)
    const timeout = window.setTimeout(() => setRoomPlayerId(getRoomPlayerId(room.code)), 0)
    return () => window.clearTimeout(timeout)
  }, [room.code])

  async function loadAll() {
    if (!userId || pendingSubmissionRef.current) return

    const state = await getGameStateAction(room.id, roomPlayerId)

    if (state.room) {
      setRoomStatus(state.room.status)
      setTotalRounds(state.room.total_rounds)
      if (state.room.status === 'lobby') router.push(`/lobby/${room.code}`)
    }
    setRound(state.round)
    setPlayers(state.players)
    setMe(state.me)
    setQuestion(state.question)
    setMainQuestion(state.mainQuestion)
    setImposterQuestion(state.imposterQuestion)
    setIsTraitor(state.isTraitor)
    const optimisticAnswer = optimisticAnswerRef.current
    const optimisticVote = optimisticVoteRef.current
    const optimisticSkip = optimisticSkipRef.current
    if (optimisticAnswer && state.answers.some((answer) => answer.player_id === optimisticAnswer.player_id)) optimisticAnswerRef.current = null
    if (optimisticVote && state.votes.some((vote) => vote.voter_id === optimisticVote.voter_id && vote.voted_for_id === optimisticVote.voted_for_id)) optimisticVoteRef.current = null
    if (optimisticSkip && state.skips.includes(optimisticSkip)) optimisticSkipRef.current = null
    setAnswers(optimisticAnswer && !state.answers.some((answer) => answer.player_id === optimisticAnswer.player_id) ? [...state.answers, optimisticAnswer] : state.answers)
    setVotes(optimisticVote && !state.votes.some((vote) => vote.voter_id === optimisticVote.voter_id && vote.voted_for_id === optimisticVote.voted_for_id)
      ? [...state.votes.filter((vote) => vote.voter_id !== optimisticVote.voter_id), optimisticVote]
      : state.votes)
    setSkips(optimisticSkip && !state.skips.includes(optimisticSkip) ? [...state.skips, optimisticSkip] : state.skips)
  }

  function scheduleLoadAll() {
    if (refreshTimer.current !== null) window.clearTimeout(refreshTimer.current)
    refreshTimer.current = window.setTimeout(() => {
      refreshTimer.current = null
      void loadAll()
    }, 100)
  }

  useEffect(() => {
    if (!userId) return
    const supabase = createClient()
    let channel = supabase
      .channel(`game:${room.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${room.id}` }, scheduleLoadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` }, scheduleLoadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rounds', filter: `room_id=eq.${room.id}` }, scheduleLoadAll)
    if (round?.id) {
      channel = channel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'answers', filter: `round_id=eq.${round.id}` }, scheduleLoadAll)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'votes', filter: `round_id=eq.${round.id}` }, scheduleLoadAll)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'discussion_skips', filter: `round_id=eq.${round.id}` }, scheduleLoadAll)
    }
    channel.subscribe()
    const timeout = window.setTimeout(loadAll, 0)
    const fallbackInterval = window.setInterval(loadAll, 3000)

    return () => {
      window.clearTimeout(timeout)
      window.clearInterval(fallbackInterval)
      if (refreshTimer.current !== null) window.clearTimeout(refreshTimer.current)
      void supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id, roomPlayerId, round?.id, userId])

  useEffect(() => {
    advancing.current = false
    nextRoundStarting.current = false
  }, [round?.id, round?.phase])

  const allAnswered = players.length > 0 && players.every((p) => answers.some((a) => a.player_id === p.id))
  const allVoted = players.length > 0 && players.every((p) => votes.some((v) => v.voter_id === p.id))
  const isHost = me?.is_host ?? false
  const roundSoundResult = getRoundSoundResult(round, votes, me)

  useEffect(() => {
    if (round?.phase === 'answering' && allAnswered && isHost && !pendingSubmission && !advancing.current) {
      advancing.current = true
      advanceToQuestionReveal(round.id)
    }
  }, [round?.phase, allAnswered, isHost, pendingSubmission, round?.id])

  useEffect(() => {
    if (round?.phase === 'question_reveal' && isHost && !advancing.current) {
      advancing.current = true
      const timeout = setTimeout(() => advanceToDiscussion(round.id), 12000)
      return () => clearTimeout(timeout)
    }
  }, [round?.phase, isHost, round?.id])

  useEffect(() => {
    if (round?.phase !== 'discussion' || !round.discussion_ends_at) {
      return
    }

    const allSkipped = players.length > 0 && players.every((p) => skips.includes(p.id))
    if (allSkipped && !pendingSubmission && !advancing.current) {
      advancing.current = true
      advanceToVoting(round.id)
      return
    }

    const updateRemaining = () => {
      const remaining = Math.max(0, Math.ceil((new Date(round.discussion_ends_at!).getTime() - Date.now()) / 1000))
      setSecondsLeft(remaining)
      if (remaining === 0) {
        if (isHost && !advancing.current) {
          advancing.current = true
          advanceToVoting(round.id)
        }
      }
    }

    updateRemaining()
    const interval = setInterval(updateRemaining, 500)

    return () => clearInterval(interval)
  }, [round?.phase, round?.discussion_ends_at, isHost, pendingSubmission, round?.id, players, skips])

  useEffect(() => {
    if (round?.phase === 'voting' && allVoted && isHost && !pendingSubmission && !advancing.current) {
      advancing.current = true
      advanceToReveal(round.id)
    }
  }, [round?.phase, allVoted, isHost, pendingSubmission, round?.id])

  useResultSound(roundSoundResult, round?.phase === 'reveal' ? round.id : null)

  if (!round || !me || !question) {
    return (
      <main className="spy-screen">
        <div className="screen-shadows" aria-hidden="true" />
        <section className="game-panel">
          <p className="case-label">Loading round</p>
          <p className="quiet-copy mt-2">Preparing the case file...</p>
        </section>
      </main>
    )
  }

  const myAnswer = answers.find((answer) => answer.player_id === me.id)
  const myVote = votes.find((vote) => vote.voter_id === me.id)
  const iSkipped = skips.includes(me.id)
  const displaySeconds = round.phase === 'discussion'
    ? round.discussion_ends_at
      ? (() => {
        // eslint-disable-next-line react-hooks/purity
        const remaining = Math.max(0, Math.ceil((new Date(round.discussion_ends_at).getTime() - Date.now()) / 1000))
        return remaining === 0 ? 0 : Math.min(120, remaining + 1)
        })()
      : 120
    : secondsLeft

  async function handleAnswer(answeredPlayer: Player) {
    if (myAnswer) return
    const previousAnswers = answers
    const optimisticAnswer: Answer = {
      id: `optimistic-answer-${me!.id}`,
      round_id: round!.id,
      player_id: me!.id,
      answered_player_id: answeredPlayer.id,
      text: answeredPlayer.name,
      created_at: new Date().toISOString(),
    }
    setAnswers((current) => [...current, optimisticAnswer])
    optimisticAnswerRef.current = optimisticAnswer
    pendingSubmissionRef.current = true
    setPendingSubmission(true)
    try {
      await submitAnswer(round!.id, answeredPlayer.id)
      await new Promise((resolve) => window.setTimeout(resolve, 2000))
    } catch (error) {
      setAnswers(previousAnswers)
      optimisticAnswerRef.current = null
      console.error('Submit answer failed', error)
    } finally {
      pendingSubmissionRef.current = false
      setPendingSubmission(false)
    }
  }

  async function handleVote(votedForId: string) {
    const previousVotes = votes
    const optimisticVote: Vote = {
      id: `optimistic-vote-${me!.id}`,
      round_id: round!.id,
      voter_id: me!.id,
      voted_for_id: votedForId,
      created_at: new Date().toISOString(),
    }
    setVotes((current) => [...current.filter((vote) => vote.voter_id !== me!.id), optimisticVote])
    optimisticVoteRef.current = optimisticVote
    pendingSubmissionRef.current = true
    setPendingSubmission(true)
    try {
      await submitVote(round!.id, votedForId)
      await new Promise((resolve) => window.setTimeout(resolve, 2000))
    } catch (error) {
      setVotes(previousVotes)
      optimisticVoteRef.current = null
      console.error('Submit vote failed', error)
    } finally {
      pendingSubmissionRef.current = false
      setPendingSubmission(false)
    }
  }

  async function handleSkip() {
    if (iSkipped) return
    const previousSkips = skips
    setSkips((current) => [...current, me!.id])
    optimisticSkipRef.current = me!.id
    pendingSubmissionRef.current = true
    setPendingSubmission(true)
    try {
      await markSkipDiscussion(round!.id)
      await new Promise((resolve) => window.setTimeout(resolve, 2000))
    } catch (error) {
      setSkips(previousSkips)
      optimisticSkipRef.current = null
      console.error('Skip discussion failed', error)
    } finally {
      pendingSubmissionRef.current = false
      setPendingSubmission(false)
    }
  }

  if (roomStatus === 'ended') {
    async function handlePlayAgain() {
      await resetGame(room.id)
      router.push(`/lobby/${room.code}`)
    }

    return (
      <main className="spy-screen">
        <div className="screen-shadows" aria-hidden="true" />
        <section className="game-panel">
          <p className="case-label">Final report</p>
          <h1 className="brand-title text-[clamp(2.2rem,8vw,4rem)]">Case Closed</h1>
          <Scoreboard players={players} />
          <div className="button-stack mx-auto mt-5">
            {isHost && (
              <button onClick={handlePlayAgain} className="primary-action">
                Stay and Play Again
              </button>
            )}
            <Link href="/" className="text-button grid place-items-center">
              Back to Home
            </Link>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="spy-screen">
      <div className="screen-shadows" aria-hidden="true" />
      <section className="game-panel">
        <p className="case-label">
          Round {round.round_number} / {totalRounds}
        </p>

        {round.phase === 'answering' && (
          <div className="game-stack mx-auto">
            <h1 className="question-text">{question.text}</h1>
            {!myAnswer ? (
              <>
                <p className="quiet-copy mx-auto">Choose one player. Their name becomes your answer.</p>
                <div className="choice-grid">
                  {players.map((player) => (
                    <button key={player.id} onClick={() => handleAnswer(player)} className="choice-row">
                      <AvatarBadge avatar={player.avatar} name={player.name} />
                      <strong>{player.name}</strong>
                      <small>Choose</small>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="quiet-copy mx-auto">
              {allAnswered
                ? 'Everyone answered. Preparing the final reveal...'
                : `You chose ${myAnswer.text}. Waiting for others (${answers.length}/${players.length} answered).`}
              </p>
            )}
          </div>
        )}

        {round.phase === 'question_reveal' && (
          <div className="game-stack mx-auto">
            {isTraitor && (
              <div className="stamp mx-auto">You are the spy</div>
            )}
            <p className="case-label">The real question was</p>
            <h1 className="question-text">{mainQuestion?.text}</h1>
            <div className="answer-list">
              {players.map((player) => {
                const answer = answers.find((item) => item.player_id === player.id)
                return (
                  <div key={player.id} className="player-row">
                    <AvatarBadge avatar={player.avatar} name={player.name} />
                    <strong>{player.name}</strong>
                    <span className="status-pill">{answer?.text ?? '...'}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {round.phase === 'discussion' && (
          <div className="game-stack mx-auto">
            <p className="case-label">Discussion</p>
            <div className="big-timer">{displaySeconds}s</div>
            <p className="quiet-copy mx-auto">Talk it out. Who answered like they had the wrong question?</p>

            <div className="answer-list">
              <p className="case-label text-left">Answers on record</p>
              {players.map((player) => {
                const answer = answers.find((item) => item.player_id === player.id)
                return (
                  <div key={player.id} className="player-row">
                    <AvatarBadge avatar={player.avatar} name={player.name} />
                    <strong>{player.name}</strong>
                    <span className="status-pill">{answer?.text ?? '...'}</span>
                  </div>
                )
              })}
            </div>

            <button onClick={handleSkip} disabled={iSkipped} className="secondary-action">
              {iSkipped ? `Waiting (${skips.length}/${players.length})` : 'Skip Discussion'}
            </button>
          </div>
        )}

        {round.phase === 'voting' && (
          <div className="game-stack mx-auto">
            <p className="case-label">Final call</p>
            <h1 className="question-text">Who is the spy?</h1>
            <div className="choice-grid">
              {players.map((player) => (
                <button
                  key={player.id}
                  onClick={() => handleVote(player.id)}
                  disabled={allVoted}
                  className={`choice-row ${myVote?.voted_for_id === player.id ? 'selected' : ''}`}
                >
                  <AvatarBadge avatar={player.avatar} name={player.name} />
                  <strong>{player.name}</strong>
                  <span className="vote-action">{myVote?.voted_for_id === player.id ? 'Vote locked' : 'Vote'}</span>
                </button>
              ))}
            </div>
            <p className="quiet-copy mx-auto">
              {allVoted ? 'Everyone has voted.' : `${votes.length}/${players.length} votes locked.`}
            </p>
          </div>
        )}

        {round.phase === 'reveal' && (
          <RevealPhase
            roomId={room.id}
            round={round}
            players={players}
            votes={votes}
            imposterQuestion={imposterQuestion}
            isHost={isHost}
            totalRounds={totalRounds}
            nextRoundStartingRef={nextRoundStarting}
          />
        )}
      </section>

      <Chat roomId={room.id} me={me} players={players} />
    </main>
  )
}
function getRoundSoundResult(round: Round | null, votes: Vote[], me: Player | null): 'win' | 'lose' | null {
  if (!round || round.phase !== 'reveal' || !me) return null

  const tally: Record<string, number> = {}
  for (const vote of votes) tally[vote.voted_for_id] = (tally[vote.voted_for_id] ?? 0) + 1

  const maxVotes = Math.max(0, ...Object.values(tally))
  if (maxVotes === 0) return null

  const topVoted = Object.entries(tally).filter(([, count]) => count === maxVotes).map(([id]) => id)
  const imposterCaught = topVoted.length === 1 && topVoted[0] === round.imposter_player_id
  const iAmTraitor = me.id === round.imposter_player_id
  const iWonRound = imposterCaught ? !iAmTraitor : iAmTraitor

  return iWonRound ? 'win' : 'lose'
}

function useResultSound(result: 'win' | 'lose' | null, soundKey: string | null) {
  const lastPlayed = useRef<string | null>(null)

  useEffect(() => {
    if (!result || !soundKey || lastPlayed.current === soundKey) return
    lastPlayed.current = soundKey
    playResultSound(result)
  }, [result, soundKey])
}

function playResultSound(result: 'win' | 'lose') {
  const AudioContextClass = window.AudioContext || (window as WindowWithWebAudio).webkitAudioContext
  if (!AudioContextClass) return

  const context = new AudioContextClass()
  const master = context.createGain()
  master.gain.setValueAtTime(0.0001, context.currentTime)
  master.gain.exponentialRampToValueAtTime(0.28, context.currentTime + 0.03)
  master.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 1.25)
  master.connect(context.destination)

  const notes = result === 'win'
    ? [523.25, 659.25, 783.99, 1046.5]
    : [392, 329.63, 261.63]

  notes.forEach((frequency, index) => {
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const startsAt = context.currentTime + index * (result === 'win' ? 0.13 : 0.2)
    const endsAt = startsAt + (result === 'win' ? 0.22 : 0.34)

    oscillator.type = result === 'win' ? 'triangle' : 'sine'
    oscillator.frequency.setValueAtTime(frequency, startsAt)
    gain.gain.setValueAtTime(0.0001, startsAt)
    gain.gain.exponentialRampToValueAtTime(result === 'win' ? 0.45 : 0.32, startsAt + 0.03)
    gain.gain.exponentialRampToValueAtTime(0.0001, endsAt)

    oscillator.connect(gain)
    gain.connect(master)
    oscillator.start(startsAt)
    oscillator.stop(endsAt + 0.04)
  })

  window.setTimeout(() => context.close(), 1400)
}

type WindowWithWebAudio = Window & {
  webkitAudioContext?: typeof AudioContext
}

function RevealPhase({
  roomId,
  round,
  players,
  votes,
  imposterQuestion,
  isHost,
  totalRounds,
  nextRoundStartingRef,
}: {
  roomId: string
  round: Round
  players: Player[]
  votes: Vote[]
  imposterQuestion: Question | null
  isHost: boolean
  totalRounds: number
  nextRoundStartingRef: MutableRefObject<boolean>
}) {
  const imposter = players.find((player) => player.id === round.imposter_player_id)
  const tally: Record<string, number> = {}
  for (const vote of votes) tally[vote.voted_for_id] = (tally[vote.voted_for_id] ?? 0) + 1

  const maxVotes = Math.max(0, ...Object.values(tally))
  const topVoted = Object.entries(tally).filter(([, count]) => count === maxVotes).map(([id]) => id)
  const imposterCaught = topVoted.length === 1 && topVoted[0] === round.imposter_player_id
  const isLastRound = round.round_number >= totalRounds

  async function handleNextOrEnd() {
    if (nextRoundStartingRef.current) return
    nextRoundStartingRef.current = true
    if (isLastRound) await endGame(roomId)
    else await startRound(roomId)
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => void handleNextOrEnd(), 10000)
    return () => window.clearTimeout(timeout)
    // The reveal round id controls this one-time countdown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round.id])

  return (
    <div className="game-stack mx-auto">
      <div className={`stamp mx-auto ${imposterCaught ? '' : 'green'}`}>
        {imposterCaught ? 'Traitor caught' : 'Traitor escaped'}
      </div>
      <p className="case-label">Traitor was</p>
      <div className="reveal-name">{imposter?.name ?? 'Unknown'}</div>

      <div className="answer-list">
        <p className="case-label text-left">Vote breakdown</p>
        {players.map((player) => (
          <div key={player.id} className="vote-row">
            <AvatarBadge avatar={player.avatar} name={player.name} />
            <strong>{player.name}</strong>
            <span className="status-pill">{tally[player.id] ?? 0} votes</span>
          </div>
        ))}
      </div>

      <div className="imposter-question-card">
        <p className="case-label">Traitor question</p>
        <p>{imposterQuestion?.text ?? 'Unknown'}</p>
      </div>

      <Scoreboard players={players} />

      {isHost && (
        <button onClick={handleNextOrEnd} className="primary-action">
          {isLastRound ? 'End Game' : 'Start Next Round'}
        </button>
      )}
    </div>
  )
}
function Scoreboard({ players }: { players: Player[] }) {
  const romanRanks = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']
  const rankedPlayers = [...players].sort((a, b) => b.score - a.score)

  return (
    <div className="score-list mt-5">
      <p className="case-label text-left">Scoreboard</p>
      {rankedPlayers.map((player) => {
        const displayRank = rankedPlayers.findIndex((item) => item.score === player.score) + 1

        return (
        <div key={player.id} className={`score-row scoreboard-row ${displayRank === 1 ? 'score-leader' : ''}`}>
          <span className={`rank-medal rank-${displayRank}`} aria-label={`Rank ${displayRank}`}>
            {romanRanks[displayRank - 1] ?? `#${displayRank}`}
          </span>
          <AvatarBadge avatar={player.avatar} name={player.name} />
          <span className="score-name">
            <strong>{player.name}</strong>
            <small>{displayRank === 1 ? 'Current lead' : 'Agent score'}</small>
          </span>
          <span className="score-points">{player.score}<small>pts</small></span>
        </div>
        )
      })}
    </div>
  )
}

