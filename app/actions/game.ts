'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireHostPlayer } from '@/lib/session'
import { enforceRateLimit } from '@/lib/rate-limit'

const DISCUSSION_DURATION_SECONDS = 120

export async function startRound(roomId: string) {
  await enforceRateLimit('start-round', 30, 60_000)
  const supabase = createAdminClient()
  await requireHostPlayer(supabase, roomId)

  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select('status,total_rounds,category')
    .eq('id', roomId)
    .single()
  if (roomError || !room) throw new Error('Room not found')
  if (room.status === 'ended') throw new Error('This game has ended.')

  const { data: players } = await supabase.from('players').select().eq('room_id', roomId)
  if (!players || players.length < 3) {
    throw new Error('Not enough players')
  }
  if (!players.every((player) => player.is_ready)) {
    throw new Error('Every player must be ready before starting.')
  }

  const { data: rounds } = await supabase
    .from('rounds')
    .select('id,round_number,phase')
    .eq('room_id', roomId)
    .order('round_number', { ascending: false })
    .limit(1)

  if (rounds?.[0] && rounds[0].phase !== 'reveal') {
    throw new Error('The current round is still in progress.')
  }

  const nextRoundNumber = rounds && rounds.length > 0 ? rounds[0].round_number + 1 : 1
  if (nextRoundNumber > room.total_rounds) throw new Error('All configured rounds are complete.')
  const category = room.category ?? 'all'

  const { data: mainQuestion, error: mainError } = await supabase
    .rpc('get_random_question', { target_category: category })
    .single()

  if (mainError || !mainQuestion) throw new Error('No questions available for this category')

  const mainId = (mainQuestion as { id: string }).id

  const { data: decoyQuestion, error: decoyError } = await supabase
    .rpc('get_random_question', { target_category: category, exclude_id: mainId })
    .single()

  if (decoyError || !decoyQuestion) {
    throw new Error('Need at least 2 questions in this category to play')
  }

  const imposter = players[Math.floor(Math.random() * players.length)]

  const { error } = await supabase.from('rounds').insert({
    room_id: roomId,
    round_number: nextRoundNumber,
    question_id: mainId,
    imposter_question_id: (decoyQuestion as { id: string }).id,
    imposter_player_id: imposter.id,
    phase: 'answering',
  })

  if (error) throw error

  const { error: roomUpdateError } = await supabase.from('rooms').update({ status: 'playing' }).eq('id', roomId)
  if (roomUpdateError) throw roomUpdateError
}

export async function advanceToQuestionReveal(roundId: string) {
  await enforceRateLimit('advance-round', 30, 60_000)
  const supabase = createAdminClient()
  const { data: round } = await supabase.from('rounds').select('room_id,phase').eq('id', roundId).single()
  if (!round) throw new Error('Round not found')
  if (round.phase !== 'answering') throw new Error('Round is not in the answering phase.')
  await requireHostPlayer(supabase, round.room_id)
  const { error } = await supabase.from('rounds').update({ phase: 'question_reveal' }).eq('id', roundId)
  if (error) throw error
}

export async function advanceToDiscussion(roundId: string) {
  await enforceRateLimit('advance-round', 30, 60_000)
  const supabase = createAdminClient()
  const { data: round } = await supabase.from('rounds').select('room_id,phase').eq('id', roundId).single()
  if (!round) throw new Error('Round not found')
  if (round.phase !== 'question_reveal') throw new Error('Round is not ready for discussion.')
  await requireHostPlayer(supabase, round.room_id)
  const discussionEndsAt = new Date(Date.now() + DISCUSSION_DURATION_SECONDS * 1000).toISOString()
  const { error } = await supabase
    .from('rounds')
    .update({ phase: 'discussion', discussion_ends_at: discussionEndsAt })
    .eq('id', roundId)
  if (error) throw error
}

export async function advanceToVoting(roundId: string) {
  await enforceRateLimit('advance-round', 30, 60_000)
  const supabase = createAdminClient()
  const { data: round } = await supabase.from('rounds').select('room_id,phase').eq('id', roundId).single()
  if (!round) throw new Error('Round not found')
  if (round.phase !== 'discussion') throw new Error('Round is not ready for voting.')
  await requireHostPlayer(supabase, round.room_id)
  const { error } = await supabase.from('rounds').update({ phase: 'voting' }).eq('id', roundId)
  if (error) throw error
}

export async function advanceToReveal(roundId: string) {
  await enforceRateLimit('advance-round', 30, 60_000)
  const supabase = createAdminClient()

  const { data: round } = await supabase.from('rounds').select().eq('id', roundId).single()
  if (!round) throw new Error('Round not found')
  if (round.phase !== 'voting') throw new Error('Round is not ready to reveal.')
  await requireHostPlayer(supabase, round.room_id)

  const { data: votes } = await supabase.from('votes').select().eq('round_id', roundId)
  if (!votes) throw new Error('No votes found')

  // Claim the transition before scoring so two concurrent host requests
  // cannot both award points.
  const { data: claimedRound, error: claimError } = await supabase
    .from('rounds')
    .update({ phase: 'reveal' })
    .eq('id', roundId)
    .eq('phase', 'voting')
    .select('id')
    .maybeSingle()
  if (claimError) throw claimError
  if (!claimedRound) throw new Error('This round has already been revealed.')

  const tally: Record<string, number> = {}
  for (const v of votes) {
    tally[v.voted_for_id] = (tally[v.voted_for_id] ?? 0) + 1
  }

  const maxVotes = Math.max(0, ...Object.values(tally))
  const topVoted = Object.entries(tally).filter(([, count]) => count === maxVotes).map(([id]) => id)
  const imposterCaught = topVoted.length === 1 && topVoted[0] === round.imposter_player_id

  const { data: players } = await supabase.from('players').select().eq('room_id', round.room_id)
  if (!players) throw new Error('No players found')

  for (const player of players) {
    const isImposter = player.id === round.imposter_player_id
    let pointsToAdd = 0
    if (imposterCaught && !isImposter) pointsToAdd = 1
    if (!imposterCaught && isImposter) pointsToAdd = 2

    if (pointsToAdd > 0) {
      await supabase.from('players').update({ score: player.score + pointsToAdd }).eq('id', player.id)
    }
  }

}

export async function endGame(roomId: string) {
  await enforceRateLimit('end-game', 10, 60_000)
  const supabase = createAdminClient()
  await requireHostPlayer(supabase, roomId)
  const { error } = await supabase.from('rooms').update({ status: 'ended' }).eq('id', roomId)
  if (error) throw error
}

export async function resetGame(roomId: string) {
  await enforceRateLimit('reset-game', 10, 60_000)
  const supabase = createAdminClient()
  await requireHostPlayer(supabase, roomId)

  const { data: rounds } = await supabase.from('rounds').select('id').eq('room_id', roomId)
  const roundIds = rounds?.map((r) => r.id) ?? []

  if (roundIds.length > 0) {
    await supabase.from('votes').delete().in('round_id', roundIds)
    await supabase.from('discussion_skips').delete().in('round_id', roundIds)
    await supabase.from('answers').delete().in('round_id', roundIds)
    await supabase.from('rounds').delete().in('id', roundIds)
  }

  await supabase.from('players').update({ score: 0, is_ready: false }).eq('room_id', roomId)
  await supabase.from('rooms').update({ status: 'lobby' }).eq('id', roomId)
}
