'use server'

import { createClient } from '@/lib/supabase/server'

export async function startRound(roomId: string) {
  const supabase = await createClient()

  const { data: players } = await supabase
    .from('players')
    .select()
    .eq('room_id', roomId)

  if (!players || players.length < 3) {
    throw new Error('Not enough players')
  }

  const { data: rounds } = await supabase
    .from('rounds')
    .select()
    .eq('room_id', roomId)
    .order('round_number', { ascending: false })
    .limit(1)

  const nextRoundNumber = rounds && rounds.length > 0 ? rounds[0].round_number + 1 : 1

  const { data: room } = await supabase.from('rooms').select().eq('id', roomId).single()
  const category = room?.category ?? 'all'

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

  await supabase.from('rooms').update({ status: 'playing' }).eq('id', roomId)
}
export async function advanceToDiscussion(roundId: string) {
  const supabase = await createClient()
  const discussionEndsAt = new Date(Date.now() + 90 * 1000).toISOString() // 90s discussion

  const { error } = await supabase
    .from('rounds')
    .update({ phase: 'discussion', discussion_ends_at: discussionEndsAt })
    .eq('id', roundId)

  if (error) throw error
}

export async function advanceToVoting(roundId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('rounds')
    .update({ phase: 'voting' })
    .eq('id', roundId)
  if (error) throw error
}
export async function advanceToQuestionReveal(roundId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('rounds')
    .update({ phase: 'question_reveal' })
    .eq('id', roundId)
  if (error) throw error
}
export async function advanceToReveal(roundId: string) {
  const supabase = await createClient()

  const { data: round } = await supabase.from('rounds').select().eq('id', roundId).single()
  if (!round) throw new Error('Round not found')

  const { data: votes } = await supabase.from('votes').select().eq('round_id', roundId)
  if (!votes) throw new Error('No votes found')

  // Tally votes per player
  const tally: Record<string, number> = {}
  for (const v of votes) {
    tally[v.voted_for_id] = (tally[v.voted_for_id] ?? 0) + 1
  }

  const maxVotes = Math.max(0, ...Object.values(tally))
  const topVoted = Object.entries(tally).filter(([, count]) => count === maxVotes).map(([id]) => id)

  // Imposter is only "caught" if they're the sole top-voted player (no ties)
  const imposterCaught = topVoted.length === 1 && topVoted[0] === round.imposter_player_id

  const { data: players } = await supabase.from('players').select().eq('room_id', round.room_id)
  if (!players) throw new Error('No players found')

  // Scoring: imposter caught -> everyone except imposter +1.
  // Imposter not caught -> imposter +2.
  for (const player of players) {
    const isImposter = player.id === round.imposter_player_id
    let pointsToAdd = 0
    if (imposterCaught && !isImposter) pointsToAdd = 1
    if (!imposterCaught && isImposter) pointsToAdd = 2

    if (pointsToAdd > 0) {
      await supabase
        .from('players')
        .update({ score: player.score + pointsToAdd })
        .eq('id', player.id)
    }
  }

  const { error } = await supabase.from('rounds').update({ phase: 'reveal' }).eq('id', roundId)
  if (error) throw error
}

export async function endGame(roomId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('rooms').update({ status: 'ended' }).eq('id', roomId)
  if (error) throw error
}

export async function resetGame(roomId: string) {
  const supabase = await createClient()

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