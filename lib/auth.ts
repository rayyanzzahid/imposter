const USER_ID_KEY = 'find-the-traitor-user-id'
const PLAYER_ID_PREFIX = 'find-the-traitor-player-id-'

export async function getUserId(): Promise<string> {
  const savedId = window.localStorage.getItem(USER_ID_KEY)
  if (savedId) return savedId

  const userId = crypto.randomUUID()
  window.localStorage.setItem(USER_ID_KEY, userId)
  return userId
}

export function getRoomPlayerId(roomCode: string): string | null {
  return window.localStorage.getItem(`${PLAYER_ID_PREFIX}${roomCode.toUpperCase()}`)
}

export function setRoomPlayerId(roomCode: string, playerId: string) {
  window.localStorage.setItem(`${PLAYER_ID_PREFIX}${roomCode.toUpperCase()}`, playerId)
}
