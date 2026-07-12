import { createRoomAction, joinRoomAction, setRoomCategoryAction, setTotalRoundsAction } from '@/app/actions/rooms'
import { setRoomPlayerId } from './auth'

export async function createRoom(hostName: string, avatar: string) {
  const room = await createRoomAction(hostName, avatar)
  setRoomPlayerId(room.code, room.playerId)
  return room.code
}

export async function joinRoom(code: string, playerName: string, avatar: string) {
  const room = await joinRoomAction(code, playerName, avatar)
  setRoomPlayerId(room.code, room.playerId)
  return room.code
}

export async function setRoomCategory(roomId: string, category: string, roomPlayerId: string | null) {
  await setRoomCategoryAction(roomId, category, roomPlayerId)
}

export async function setTotalRounds(roomId: string, totalRounds: number, roomPlayerId: string | null) {
  await setTotalRoundsAction(roomId, totalRounds, roomPlayerId)
}
