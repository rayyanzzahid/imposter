'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { findSessionPlayer } from '@/lib/session'
import type { Answer, Player, Question, Room, Round, Vote } from '@/lib/supabase/types'

export async function getGameStateAction(roomId: string, roomPlayerId: string | null) {
  const supabase = createAdminClient()

  const [{ data: currentRoom }, { data: rounds }, { data: players }] = await Promise.all([
    supabase.from('rooms').select('status, total_rounds').eq('id', roomId).single(),
    supabase.from('rounds').select().eq('room_id', roomId).order('round_number', { ascending: false }).limit(1),
    supabase.from('players').select().eq('room_id', roomId).order('created_at', { ascending: true }),
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

    const [qRes, mqRes, iqRes, answersRes, votesRes, skipsRes] = await Promise.all([
      supabase.from('questions').select().eq('id', myQuestionId).single(),
      supabase.from('questions').select().eq('id', currentRound.question_id).single(),
      supabase.from('questions').select().eq('id', currentRound.imposter_question_id).single(),
      supabase.from('answers').select().eq('round_id', currentRound.id),
      supabase.from('votes').select().eq('round_id', currentRound.id),
      supabase.from('discussion_skips').select('player_id').eq('round_id', currentRound.id),
    ])

    question = (qRes.data ?? null) as Question | null
    mainQuestion = (isQuestionReveal || isReveal ? mqRes.data : null) as Question | null
    imposterQuestion = (isReveal ? iqRes.data : null) as Question | null
    answers = (answersRes.data ?? []) as Answer[]
    votes = (votesRes.data ?? []) as Vote[]
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
  answeredPlayerId: string
) {
  const supabase = createAdminClient()
  const { data: round } = await supabase.from('rounds').select('id,room_id,phase').eq('id', roundId).single()
  if (!round) throw new Error('Round not found')
  if (round.phase !== 'answering') throw new Error('Answers are closed for this round.')

  const player = await findSessionPlayer(supabase, round.room_id)
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

export async function submitVoteAction(roundId: string, votedForId: string) {
  const supabase = createAdminClient()
  const { data: round } = await supabase.from('rounds').select('id,room_id,phase').eq('id', roundId).single()
  if (!round) throw new Error('Round not found')
  if (round.phase !== 'voting') throw new Error('Voting is closed for this round.')

  const voter = await findSessionPlayer(supabase, round.room_id)
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

export async function markSkipDiscussionAction(roundId: string) {
  const supabase = createAdminClient()
  const { data: round } = await supabase.from('rounds').select('id,room_id,phase').eq('id', roundId).single()
  if (!round) throw new Error('Round not found')
  if (round.phase !== 'discussion') throw new Error('Discussion is not active.')

  const player = await findSessionPlayer(supabase, round.room_id)
  const { error } = await supabase
    .from('discussion_skips')
    .upsert({ round_id: roundId, player_id: player.id }, { onConflict: 'round_id,player_id' })
  if (error) throw error
}
