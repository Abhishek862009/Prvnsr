import { getDb } from "@/server/db/client";
import { isUniqueViolation } from "@/server/db/errors";
import { DomainError } from "@/server/lib/errors";
import { decideRoomChange, validateCapacityInput, validateRoomNumberInput } from "@/server/lib/rooms";
import * as roomsRepo from "@/server/repos/rooms";

function validateCapacity(capacity: number) {
  const c = validateCapacityInput(capacity);
  if (!c.ok) throw new DomainError("validation", c.message);
}

function parseRoomNumber(input: string): { roomNumber: string; floor: number } {
  const r = validateRoomNumberInput(input);
  if (!r.ok) throw new DomainError("validation", r.message);
  return { roomNumber: r.roomNumber, floor: r.floor };
}

export const listRooms = () => roomsRepo.listRoomsWithOccupancy();

export async function createRoom(input: { roomNumber: string; capacity: number }) {
  const { roomNumber, floor } = parseRoomNumber(input.roomNumber);
  validateCapacity(input.capacity);
  try {
    const room = await roomsRepo.insertRoom({ roomNumber, floor, capacity: input.capacity });
    if (!room) throw new DomainError("conflict", "Room could not be created.");
    return room;
  } catch (err) {
    if (isUniqueViolation(err)) throw new DomainError("conflict", `Room ${roomNumber} already exists.`);
    throw err;
  }
}

/**
 * Edit a room. Capacity can never drop below its active students, and a room with active
 * students cannot be deactivated. A room cannot be renamed while checking records saved under its
 * number still exist (reports and room notes refer to that number); rules live in `decideRoomChange`.
 */
export async function updateRoom(
  id: string,
  patch: { roomNumber?: string; capacity?: number; isActive?: boolean },
) {
  const set: Partial<{ roomNumber: string; floor: number; capacity: number; isActive: boolean }> = {};
  if (patch.roomNumber !== undefined) Object.assign(set, parseRoomNumber(patch.roomNumber));
  if (patch.capacity !== undefined) {
    validateCapacity(patch.capacity);
    set.capacity = patch.capacity;
  }
  if (patch.isActive !== undefined) set.isActive = patch.isActive;
  if (Object.keys(set).length === 0) throw new DomainError("validation", "Nothing to update.");

  try {
    return await getDb().transaction(async (tx) => {
      const room = await roomsRepo.findRoomForUpdate(id, tx);
      if (!room) throw new DomainError("not_found", "Room not found.");

      const activeStudents = await roomsRepo.countActiveStudentsInRoom(id, tx);
      const renaming = set.roomNumber !== undefined && set.roomNumber !== room.roomNumber;
      const decision = decideRoomChange({
        current: { roomNumber: room.roomNumber, capacity: room.capacity, isActive: room.isActive, activeStudents },
        patch: { roomNumber: set.roomNumber, capacity: set.capacity, isActive: set.isActive },
        hasCheckHistory: renaming ? await roomsRepo.hasChecksWithRoomSnapshot(room.roomNumber, tx) : false,
      });
      if (!decision.ok) throw new DomainError("conflict", decision.message);
      const updated = await roomsRepo.updateRoomRow(id, set, tx);
      if (!updated) throw new DomainError("not_found", "Room not found.");
      return updated;
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new DomainError("conflict", "Another room already uses that number.");
    throw err;
  }
}

/**
 * Public "Available / Full" is a MANUAL Warden decision. It is never derived from student counts
 * and is independent of daily checking (vacant / green / red).
 */
export async function setRoomPublicAvailability(id: string, availability: "available" | "full") {
  const room = await roomsRepo.updateRoomRow(id, { publicAvailability: availability });
  if (!room) throw new DomainError("not_found", "Room not found.");
  return room;
}
