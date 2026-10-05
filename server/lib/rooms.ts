import { ROOM_NUMBER_PATTERN } from "./student-fields";

/** Floor is derived from the room number: 101 -> 1, 205 -> 2, 1012 -> 10. */
export function deriveFloor(roomNumber: string): number | null {
  const m = /^(\d{3,4})$/.exec(roomNumber.trim());
  if (!m?.[1]) return null;
  const floor = Number(m[1].slice(0, -2));
  return floor >= 0 ? floor : null;
}

export const MAX_ROOM_CAPACITY = 10;

// ---------------------------------------------------------------- room rules (single source of truth)

export type RoomNumberCheck = { ok: true; roomNumber: string; floor: number } | { ok: false; message: string };

/** Room number is 3-4 digits; the floor is DERIVED from it (101 -> 1), never typed separately. */
export function validateRoomNumberInput(input: string): RoomNumberCheck {
  const roomNumber = String(input ?? "").trim();
  const floor = ROOM_NUMBER_PATTERN.test(roomNumber) ? deriveFloor(roomNumber) : null;
  if (floor === null) return { ok: false, message: "Room number must be 3 or 4 digits, like 101 or 1012." };
  return { ok: true, roomNumber, floor };
}

export function validateCapacityInput(capacity: unknown): { ok: true; capacity: number } | { ok: false; message: string } {
  if (typeof capacity !== "number" || !Number.isInteger(capacity) || capacity < 1 || capacity > MAX_ROOM_CAPACITY) {
    return { ok: false, message: `Capacity must be a whole number from 1 to ${MAX_ROOM_CAPACITY}.` };
  }
  return { ok: true, capacity };
}

export type SpaceDecision = "ok" | "room_inactive" | "room_full";

/** Can one more ACTIVE student be placed in this room? */
export function roomSpaceDecision(r: { isActive: boolean; capacity: number; activeStudents: number }): SpaceDecision {
  if (!r.isActive) return "room_inactive";
  return r.activeStudents >= r.capacity ? "room_full" : "ok";
}

export type RoomChangeDecision = { ok: true } | { ok: false; message: string };

/**
 * Guards for editing a room so daily-checking data cannot be broken:
 *  - capacity can not drop below the active students,
 *  - a room with active students can not be deactivated,
 *  - a room that still has checking records under its current number can not be renamed
 *    (records and reports refer to the number they were saved under; it can be renamed once they expire).
 */
export function decideRoomChange(args: {
  current: { roomNumber: string; capacity: number; isActive: boolean; activeStudents: number };
  patch: { roomNumber?: string; capacity?: number; isActive?: boolean };
  hasCheckHistory: boolean;
}): RoomChangeDecision {
  const { current, patch } = args;
  if (patch.capacity !== undefined && patch.capacity < current.activeStudents) {
    return { ok: false, message: `Room ${current.roomNumber} has ${current.activeStudents} active student(s). Move them before lowering capacity to ${patch.capacity}.` };
  }
  if (patch.isActive === false && current.activeStudents > 0) {
    return { ok: false, message: `Room ${current.roomNumber} has ${current.activeStudents} active student(s). Move or deactivate them before deactivating the room.` };
  }
  if (patch.roomNumber !== undefined && patch.roomNumber !== current.roomNumber && args.hasCheckHistory) {
    return { ok: false, message: `Room ${current.roomNumber} has checking records from the last 30 days saved under this number. Rename it after they expire, or add a new room instead.` };
  }
  return { ok: true };
}

export type MoveDecision =
  | { ok: true; checkCapacity: boolean }
  | { ok: false; kind: "validation" | "conflict"; message: string };

/**
 * Move to Room. An ACTIVE student takes a bed, so capacity is enforced; an INACTIVE student does not,
 * so capacity is only enforced when he is reactivated.
 */
export function decideMove(args: {
  studentActive: boolean;
  currentRoomId: string;
  targetRoomId: string;
  target: { roomNumber: string; isActive: boolean; capacity: number; activeStudents: number };
}): MoveDecision {
  if (args.currentRoomId === args.targetRoomId) return { ok: false, kind: "validation", message: "Student is already in that room." };
  if (!args.target.isActive) return { ok: false, kind: "conflict", message: `Room ${args.target.roomNumber} is inactive.` };
  if (args.studentActive && roomSpaceDecision(args.target) === "room_full") {
    return { ok: false, kind: "conflict", message: `Room ${args.target.roomNumber} is full (${args.target.activeStudents}/${args.target.capacity}).` };
  }
  return { ok: true, checkCapacity: args.studentActive };
}
