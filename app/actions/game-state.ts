'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import type { Answer, Player, Question, Room, Round, Vote } from '@/lib/supabase/types'

export async function getGameStateAction(roomId: string, userId: string, roomPlayerId: string | null) {
  const supabase = createAdminClient()

  const [{ data: currentRoom }, { data: rounds }, { data: players }] = await Promise.all([
    supabase.from('rooms').select('status, total_rounds').eq('id', roomId).single(),
    supabase.from('rounds').select().eq('room_id', roomId).order('round_number', { ascending: false }).limit(1),
    supabase.from('players').select().eq('room_id', roomId).order('created_at', { ascending: true }),
  ])

  const allPlayers = (players ?? []) as Player[]
  const player = allPlayers.find((item) => item.id === roomPlayerId) ?? allPlayers.find((item) => item.user_id === userId) ?? null
  const currentRound = ((rounds ?? [])[0] ?? null) as Round | null

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
    mainQuestion = (mqRes.data ?? null) as Question | null
    imposterQuestion = (iqRes.data ?? null) as Question | null
    answers = (answersRes.data ?? []) as Answer[]
    votes = (votesRes.data ?? []) as Vote[]
    skips = (skipsRes.data ?? []).map((skip) => skip.player_id as string)
  }

  return {
    room: currentRoom as Pick<Room, 'status' | 'total_rounds'> | null,
    round: currentRound,
    question,
    mainQuestion,
    imposterQuestion,
    me: player,
    players: allPlayers,
    answers,
    votes,
    skips,
  }
}

export async function submitAnswerAction(
  roundId: string,
  playerId: string,
  answeredPlayerId: string,
  answeredPlayerName: string
) {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('answers')
    .upsert(
      { round_id: roundId, player_id: playerId, answered_player_id: answeredPlayerId, text: answeredPlayerName },
      { onConflict: 'round_id,player_id' }
    )
  if (error) throw error
}

export async function submitVoteAction(roundId: string, voterId: string, votedForId: string) {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('votes')
    .upsert({ round_id: roundId, voter_id: voterId, voted_for_id: votedForId }, { onConflict: 'round_id,voter_id' })
  if (error) throw error
}

export async function markSkipDiscussionAction(roundId: string, playerId: string) {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('discussion_skips')
    .upsert({ round_id: roundId, player_id: playerId }, { onConflict: 'round_id,player_id' })
  if (error) throw error
}
