'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { findSessionPlayer } from '@/lib/session'
import { enforceRateLimit } from '@/lib/rate-limit'
import type { Answer, Player, Question, Room, Round, Vote } from '@/lib/supabase/types'

export async function getGameStateAction(roomId: string, roomPlayerId: string | null) {
  const supabase = createAdminClient()

  const [{ data: currentRoom }, { data: rounds }, { data: players }] = await Promise.all([
    supabase.from('rooms').select('status, total_rounds').eq('id', roomId).single(),
    supabase
      .from('rounds')
      .select('id,room_id,round_number,question_id,imposter_question_id,imposter_player_id,phase,discussion_ends_at,created_at')
      .eq('room_id', roomId)
      .order('round_number', { ascending: false })
      .limit(1),
    supabase
      .from('players')
      .select('id,room_id,user_id,name,avatar,is_host,is_ready,score,created_at')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true }),
  ])

  const allPlayers = (players ?? []) as Player[]
  const player = allPlayers.length > 0 ? await findSessionPlayer(supabase, roomId, roomPlayerId) : null
  const currentRound = ((rounds ?? [])[0] ?? null) as Round | null

  const isReveal = currentRound?.phase === 'reveal'
  const isQuestionReveal = currentRound?.phase === 'question_reveal'
  const safeRound = currentRound
    ? {
      ...currentRound,
      imposter_player_id: isReveal ? currentRound.imposter_player_id : '',
      imposter_question_id: isReveal ? currentRound.imposter_question_id : '',
    }
    : null
  let question: Question | null = null
  let mainQuestion: Question | null = null
  let imposterQuestion: Question | null = null
  let answers: Answer[] = []
  let votes: Vote[] = []
  let skips: string[] = []

  if (currentRound && player) {
    const isImposter = currentRound.imposter_player_id === player.id
    const myQuestionId = isImposter ? currentRound.imposter_question_id : currentRound.question_id
    const needsQuestion = currentRound.phase === 'answering'
    const needsMainQuestion = isQuestionReveal || isReveal
    const needsImposterQuestion = isReveal
    const needsAnswers = ['answering', 'question_reveal', 'discussion', 'reveal'].includes(currentRound.phase)
    const needsVotes = currentRound.phase === 'voting' || isReveal
    const needsSkips = currentRound.phase === 'discussion'

    const [qRes, mqRes, iqRes, answersRes, votesRes, skipsRes] = await Promise.all([
      needsQuestion
        ? supabase.from('questions').select('id,pack_id,text').eq('id', myQuestionId).single()
        : Promise.resolve({ data: null }),
      needsMainQuestion
        ? supabase.from('questions').select('id,pack_id,text').eq('id', currentRound.question_id).single()
        : Promise.resolve({ data: null }),
      needsImposterQuestion
        ? supabase.from('questions').select('id,pack_id,text').eq('id', currentRound.imposter_question_id).single()
        : Promise.resolve({ data: null }),
      needsAnswers
        ? supabase.from('answers').select('id,round_id,player_id,answered_player_id,text,created_at').eq('round_id', currentRound.id)
        : Promise.resolve({ data: [] }),
      needsVotes
        ? supabase.from('votes').select('id,round_id,voter_id,voted_for_id,created_at').eq('round_id', currentRound.id)
        : Promise.resolve({ data: [] }),
      needsSkips
        ? supabase.from('discussion_skips').select('player_id').eq('round_id', currentRound.id)
        : Promise.resolve({ data: [] }),
    ])

    question = (qRes.data ?? null) as Question | null
    mainQuestion = (isQuestionReveal || isReveal ? mqRes.data : null) as Question | null
    imposterQuestion = (isReveal ? iqRes.data : null) as Question | null
    const allAnswers = (answersRes.data ?? []) as Answer[]
    const allVotes = (votesRes.data ?? []) as Vote[]

    // Keep hidden choices out of the serialized server-action response. The
    // client still needs counts for the waiting states, but should not be
    // able to inspect another player's answer or vote before the reveal.
    answers = currentRound.phase === 'answering'
      ? allAnswers.map((answer) => answer.player_id === player.id
        ? answer
        : { ...answer, answered_player_id: '', text: '' })
      : allAnswers
    votes = currentRound.phase === 'voting'
      ? allVotes.map((vote) => vote.voter_id === player.id
        ? vote
        : { ...vote, voted_for_id: '' })
      : allVotes
    skips = (skipsRes.data ?? []).map((skip) => skip.player_id as string)
  }

  return {
    room: currentRoom as Pick<Room, 'status' | 'total_rounds'> | null,
    round: safeRound as Round | null,
    question,
    mainQuestion,
    imposterQuestion,
    isTraitor: currentRound?.imposter_player_id === player?.id,
    me: player,
    players: allPlayers,
    answers,
    votes,
    skips,
  }
}

export async function submitAnswerAction(
  roundId: string,
  answeredPlayerId: string,
  roomPlayerId?: string | null
) {
  const supabase = createAdminClient()
  const { data: round } = await supabase.from('rounds').select('id,room_id,phase').eq('id', roundId).single()
  if (!round) throw new Error('Round not found')
  if (round.phase !== 'answering') throw new Error('Answers are closed for this round.')

  const player = await findSessionPlayer(supabase, round.room_id, roomPlayerId)
  await enforceRateLimit('submit-answer', 20, 60_000)
  const { data: answeredPlayer } = await supabase
    .from('players')
    .select('id,name')
    .eq('id', answeredPlayerId)
    .eq('room_id', round.room_id)
    .single()

  if (!answeredPlayer) throw new Error('That player is not in this room.')

  const { error } = await supabase
    .from('answers')
    .upsert(
      { round_id: roundId, player_id: player.id, answered_player_id: answeredPlayer.id, text: answeredPlayer.name },
      { onConflict: 'round_id,player_id' }
    )
  if (error) throw error
}

export async function submitVoteAction(roundId: string, votedForId: string, roomPlayerId?: string | null) {
  const supabase = createAdminClient()
  const { data: round } = await supabase.from('rounds').select('id,room_id,phase').eq('id', roundId).single()
  if (!round) throw new Error('Round not found')
  if (round.phase !== 'voting') throw new Error('Voting is closed for this round.')

  const voter = await findSessionPlayer(supabase, round.room_id, roomPlayerId)
  await enforceRateLimit('submit-vote', 20, 60_000)
  const { data: votedFor } = await supabase
    .from('players')
    .select('id')
    .eq('id', votedForId)
    .eq('room_id', round.room_id)
    .single()

  if (!votedFor) throw new Error('That player is not in this room.')

  const { error } = await supabase
    .from('votes')
    .upsert({ round_id: roundId, voter_id: voter.id, voted_for_id: votedFor.id }, { onConflict: 'round_id,voter_id' })
  if (error) throw error
}

export async function markSkipDiscussionAction(roundId: string, roomPlayerId?: string | null) {
  const supabase = createAdminClient()
  const { data: round } = await supabase.from('rounds').select('id,room_id,phase').eq('id', roundId).single()
  if (!round) throw new Error('Round not found')
  if (round.phase !== 'discussion') throw new Error('Discussion is not active.')

  const player = await findSessionPlayer(supabase, round.room_id, roomPlayerId)
  await enforceRateLimit('skip-discussion', 20, 60_000)
  const { error } = await supabase
    .from('discussion_skips')
    .upsert({ round_id: roundId, player_id: player.id }, { onConflict: 'round_id,player_id' })
  if (error) throw error

  const [{ count: playerCount, error: playerCountError }, { count: skipCount, error: skipCountError }] = await Promise.all([
    supabase.from('players').select('id', { count: 'exact', head: true }).eq('room_id', round.room_id),
    supabase.from('discussion_skips').select('player_id', { count: 'exact', head: true }).eq('round_id', roundId),
  ])
  if (playerCountError) throw playerCountError
  if (skipCountError) throw skipCountError

  if ((playerCount ?? 0) > 0 && (skipCount ?? 0) >= (playerCount ?? 0)) {
    const { error: advanceError } = await supabase
      .from('rounds')
      .update({ phase: 'voting', discussion_ends_at: null })
      .eq('id', roundId)
      .eq('phase', 'discussion')
    if (advanceError) throw advanceError
  }
}
