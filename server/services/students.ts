import { getEnv } from "@/server/config/env";
import { getDb, type Tx } from "@/server/db/client";
import { isUniqueViolation } from "@/server/db/errors";
import { todayInZone } from "@/server/lib/dates";
import { DomainError } from "@/server/lib/errors";
import { decideMove, roomSpaceDecision } from "@/server/lib/rooms";
import { mergeStudentPatch, validateStudentFields, type RawStudentFields } from "@/server/lib/student-fields";
import * as checkingRepo from "@/server/repos/checking";
import * as roomsRepo from "@/server/repos/rooms";
import * as studentsRepo from "@/server/repos/students";

export type StudentFilters = { q?: string; roomId?: string; status?: "active" | "inactive" | "all" };

export const searchStudents = (filters: StudentFilters) => studentsRepo.listStudents(filters);

export async function getStudent(id: string) {
  const s = await studentsRepo.findStudentById(id);
  if (!s) throw new DomainError("not_found", "Student not found.");
  return s;
}

/** Locks the room, verifies it is active and that one more ACTIVE student fits. */
async function assertRoomHasSpace(tx: Tx, roomId: string) {
  const room = await roomsRepo.findRoomForUpdate(roomId, tx);
  if (!room) throw new DomainError("not_found", "Room not found.");
  if (!room.isActive) throw new DomainError("conflict", `Room ${room.roomNumber} is inactive.`);
  const active = await roomsRepo.countActiveStudentsInRoom(roomId, tx);
  if (roomSpaceDecision({ isActive: room.isActive, capacity: room.capacity, activeStudents: active }) === "room_full") {
    throw new DomainError("conflict", `Room ${room.roomNumber} is full (${active}/${room.capacity}).`);
  }
}

/**
 * A student joining a room (new, moved in, reactivated) is not checked yet, so today's manual
 * "vacant"/"complete" marks for that room no longer apply and the room turns red until saved.
 */
async function resetRoomDayState(tx: Tx, roomId: string) {
  await checkingRepo.clearRoomFlags(roomId, todayInZone(getEnv().APP_TIMEZONE), tx);
}

function validated(raw: RawStudentFields) {
  const v = validateStudentFields(raw);
  if (!v.ok) throw new DomainError("validation", "Some student fields are invalid.", { errors: v.errors });
  return v.value;
}

function uniqueCodeConflict(err: unknown): never {
  if (isUniqueViolation(err)) throw new DomainError("conflict", "That student code is already used by another student.");
  throw err;
}

export async function createStudent(input: RawStudentFields & { roomId: string }) {
  const fields = validated(input);
  try {
    const id = await getDb().transaction(async (tx) => {
      await assertRoomHasSpace(tx, input.roomId);
      const row = await studentsRepo.insertStudent({ ...fields, roomId: input.roomId }, tx);
      if (!row) throw new DomainError("conflict", "Student could not be created.");
      await resetRoomDayState(tx, input.roomId);
      return row.id;
    });
    return await getStudent(id);
  } catch (err) {
    return uniqueCodeConflict(err);
  }
}

/** Edits details only. Room changes go through moveStudent so capacity is always checked. */
export async function updateStudent(id: string, patch: RawStudentFields) {
  const current = await getStudent(id);
  const merged = mergeStudentPatch(current, patch);
  const fields = validated(merged);
  try {
    await studentsRepo.updateStudentRow(id, fields);
  } catch (err) {
    uniqueCodeConflict(err);
  }
  return getStudent(id);
}

/**
 * Move to Room. The student keeps the same ID, so all history stays linked. Past daily checks keep
 * their own room-number snapshot, so old records still show the old room.
 */
export async function moveStudent(id: string, targetRoomId: string) {
  await getDb().transaction(async (tx) => {
    const student = await studentsRepo.findStudentForUpdate(id, tx);
    if (!student) throw new DomainError("not_found", "Student not found.");
    const room = await roomsRepo.findRoomForUpdate(targetRoomId, tx);
    if (!room) throw new DomainError("not_found", "Room not found.");
    const decision = decideMove({
      studentActive: student.isActive,
      currentRoomId: student.roomId,
      targetRoomId,
      target: {
        roomNumber: room.roomNumber,
        isActive: room.isActive,
        capacity: room.capacity,
        activeStudents: await roomsRepo.countActiveStudentsInRoom(targetRoomId, tx),
      },
    });
    if (!decision.ok) throw new DomainError(decision.kind, decision.message);
    await studentsRepo.updateStudentRow(id, { roomId: targetRoomId }, tx);
    if (student.isActive) await resetRoomDayState(tx, targetRoomId);
  });
  return getStudent(id);
}

/** Deactivate (never delete) or reactivate. Reactivation re-checks room capacity. */
export async function setStudentActive(id: string, isActive: boolean) {
  await getDb().transaction(async (tx) => {
    const student = await studentsRepo.findStudentForUpdate(id, tx);
    if (!student) throw new DomainError("not_found", "Student not found.");
    if (student.isActive === isActive) return;

    if (isActive) {
      await assertRoomHasSpace(tx, student.roomId);
      await studentsRepo.updateStudentRow(id, { isActive: true, deactivatedAt: null }, tx);
      await resetRoomDayState(tx, student.roomId);
    } else {
      await studentsRepo.updateStudentRow(id, { isActive: false, deactivatedAt: new Date() }, tx);
    }
  });
  return getStudent(id);
}
