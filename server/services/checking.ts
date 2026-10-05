import { getEnv } from "@/server/config/env";
import { getDb, type DbOrTx } from "@/server/db/client";
import { getFloorLayout } from "@/layouts";
import { validateCheckEntry, checkChanged, NOTE_MAX, type CheckEntry, type RawCheckEntry } from "@/server/lib/check-rules";
import { todayInZone } from "@/server/lib/dates";
import { DomainError } from "@/server/lib/errors";
import { validateLayout } from "@/server/lib/layout-validation";
import {
  compareRoomNumbers,
  deriveRoomStatus,
  firstPendingRoom,
  nextPendingRoom,
  summarizeProgress,
  type RoomStatus,
} from "@/server/lib/room-status";
import { summarizeAcks } from "@/server/lib/parent-report";
import * as checkingRepo from "@/server/repos/checking";
import * as reportsRepo from "@/server/repos/parent-reports";
import * as roomsRepo from "@/server/repos/rooms";
import * as studentsRepo from "@/server/repos/students";

/** Checking runs until ~11 PM IST, so "today" is always the IST calendar date. */
export const checkingDate = () => todayInZone(getEnv().APP_TIMEZONE);

export type RoomDay = {
  id: string;
  roomNumber: string;
  floor: number;
  capacity: number;
  activeStudents: number;
  status: RoomStatus;
  isVacant: boolean;
  isManuallyComplete: boolean;
};

/** Today's status of every ACTIVE room, in floor then room-number order. */
async function buildDay(date: string, dbx: DbOrTx): Promise<RoomDay[]> {
  const data = await checkingRepo.loadDayData(date, dbx);
  const checked = new Set(data.checkedStudentIds);
  const studentsByRoom = new Map<string, string[]>();
  for (const s of data.students) studentsByRoom.set(s.roomId, [...(studentsByRoom.get(s.roomId) ?? []), s.id]);
  const stateByRoom = new Map(data.states.map((s) => [s.roomId, s]));

  return data.rooms
    .map((r) => {
      const ids = studentsByRoom.get(r.id) ?? [];
      const state = stateByRoom.get(r.id);
      const isVacant = state?.isVacant ?? false;
      const isManuallyComplete = state?.isManuallyComplete ?? false;
      return {
        id: r.id,
        roomNumber: r.roomNumber,
        floor: r.floor,
        capacity: r.capacity,
        activeStudents: ids.length,
        isVacant,
        isManuallyComplete,
        status: deriveRoomStatus({ isVacant, isManuallyComplete, activeStudentIds: ids, checkedStudentIds: checked }),
      };
    })
    .sort((a, b) => a.floor - b.floor || compareRoomNumbers(a.roomNumber, b.roomNumber));
}

// ---------------- Dashboard ----------------
export async function getDashboard() {
  const date = checkingDate();
  const day = await buildDay(date, getDb());
  const { overall, floors } = summarizeProgress(day);
  const next = firstPendingRoom(day);
  return {
    date,
    overall,
    floors,
    /** First room still pending: "Continue from Room ...?" */
    continueRoom: next ? { id: next.id, roomNumber: next.roomNumber, floor: next.floor } : null,
    hasProgress: overall.completed + overall.vacant > 0,
  };
}

// ---------------- Floor map ----------------
export async function getFloorMap(floor: number) {
  const date = checkingDate();
  const day = await buildDay(date, getDb());
  const floors = [...new Set(day.map((r) => r.floor))].sort((a, b) => a - b);
  const floorRooms = day.filter((r) => r.floor === floor);

  const layout = getFloorLayout(floor);
  const issues = layout ? validateLayout(layout, floorRooms.map((r) => r.roomNumber)) : null;
  const usable = layout && issues && issues.errors.length === 0 ? layout : null;

  const tile = (r: RoomDay) => ({ roomId: r.id, roomNumber: r.roomNumber, activeStudents: r.activeStudents, status: r.status });
  const placed = new Set(usable?.rooms.map((r) => r.roomNumber) ?? []);
  return {
    date,
    floor,
    floors,
    layout: usable,
    tiles: floorRooms.filter((r) => placed.has(r.roomNumber)).map(tile),
    /** Active rooms with no position in the layout (or all rooms, if there is no usable layout). */
    unplaced: floorRooms.filter((r) => !placed.has(r.roomNumber)).map(tile),
  };
}

// ---------------- Room checking ----------------
export async function findRoomByNumberOrFail(roomNumber: string) {
  const room = await roomsRepo.findRoomByNumber(roomNumber);
  if (!room || !room.isActive) throw new DomainError("not_found", "Room not found.");
  return room;
}

export async function getRoomCheck(roomId: string) {
  const date = checkingDate();
  const db = getDb();
  const room = await roomsRepo.findRoomById(roomId, db);
  if (!room || !room.isActive) throw new DomainError("not_found", "Room not found.");

  const [activeStudents, state, day] = await Promise.all([
    studentsRepo.listActiveStudentsInRoom(roomId, db),
    checkingRepo.getRoomState(date, roomId, db),
    buildDay(date, db),
  ]);
  const checks = await checkingRepo.listChecksForStudents(date, activeStudents.map((s) => s.id), db);
  const checkByStudent = new Map(checks.map((c) => [c.studentId, c]));
  const acks = await reportsRepo.listAcknowledgementsForChecks(checks.map((c) => c.id), db);
  const me = day.find((r) => r.id === roomId);

  return {
    date,
    room: { id: room.id, roomNumber: room.roomNumber, floor: room.floor, capacity: room.capacity },
    status: me?.status ?? ("pending" as RoomStatus),
    isVacant: state?.isVacant ?? false,
    isManuallyComplete: state?.isManuallyComplete ?? false,
    commonNote: state?.commonNote ?? "",
    students: activeStudents.map((s) => {
      const c = checkByStudent.get(s.id);
      return {
        id: s.id,
        name: s.name,
        check: c
          ? {
              status: c.status,
              stars: c.stars,
              note: c.note,
              revision: c.revision,
              lastEditedAt: c.lastEditedAt,
              // Parent acknowledgement of the CURRENT revision (state + timestamp) for the Warden.
              ack: summarizeAcks(c.revision, acks.filter((a) => a.dailyCheckId === c.id)),
            }
          : null,
      };
    }),
  };
}

export type SaveRoomInput = { entries: RawCheckEntry[]; commonNote?: string | null; confirmEdit?: boolean };

/**
 * "Save & Next Room". Writes every entry for this room in one transaction.
 *  - New record -> revision 1, with a snapshot of today's room number.
 *  - Changed existing record -> revision +1 and last_edited_at (drives "Edited", re-acknowledge
 *    and "Edited after WhatsApp"). Unchanged records are left untouched.
 *  - Editing an already-complete room needs confirmEdit (the UI asks "Edit today's record?").
 */
export async function saveRoomCheck(roomId: string, input: SaveRoomInput) {
  const date = checkingDate();
  return getDb().transaction(async (tx) => {
    const room = await roomsRepo.findRoomForUpdate(roomId, tx);
    if (!room || !room.isActive) throw new DomainError("not_found", "Room not found.");

    const active = await studentsRepo.listActiveStudentsInRoom(roomId, tx);
    const activeIds = new Set(active.map((s) => s.id));

    // ---- validate everything before writing anything ----
    const problems: { studentId?: string; field: string; message: string }[] = [];
    const entries: CheckEntry[] = [];
    const seen = new Set<string>();
    for (const raw of input.entries) {
      if (!activeIds.has(raw.studentId)) {
        problems.push({ studentId: raw.studentId, field: "studentId", message: "Student is not an active student of this room." });
        continue;
      }
      if (seen.has(raw.studentId)) {
        problems.push({ studentId: raw.studentId, field: "studentId", message: "Student appears twice." });
        continue;
      }
      seen.add(raw.studentId);
      const v = validateCheckEntry(raw);
      if (v.ok) entries.push(v.value);
      else for (const e of v.errors) problems.push({ studentId: raw.studentId, ...e });
    }
    let commonNote: string | undefined;
    if (input.commonNote !== undefined && input.commonNote !== null) {
      commonNote = input.commonNote.trim();
      if (commonNote.length > NOTE_MAX) problems.push({ field: "commonNote", message: `Room note must be at most ${NOTE_MAX} characters.` });
    }
    if (entries.length === 0 && problems.length === 0 && commonNote === undefined) {
      throw new DomainError("validation", "Nothing to save.");
    }
    if (problems.length) throw new DomainError("validation", "Some entries are invalid.", { errors: problems });

    // ---- detect edits of an already-checked room ----
    const [state, existing, dayBefore] = await Promise.all([
      checkingRepo.getRoomState(date, roomId, tx),
      checkingRepo.listChecksForStudents(date, [...activeIds], tx),
      buildDay(date, tx),
    ]);
    const existingByStudent = new Map(existing.map((c) => [c.studentId, c]));
    const wasComplete = dayBefore.find((r) => r.id === roomId)?.status === "complete";
    const editsExisting =
      entries.some((e) => {
        const old = existingByStudent.get(e.studentId);
        return old ? checkChanged(old, e) : false;
      }) ||
      (commonNote !== undefined && commonNote !== (state?.commonNote ?? "") && wasComplete);
    if (wasComplete && editsExisting && !input.confirmEdit) {
      throw new DomainError("conflict", "This room is already checked. Edit today's record?", { code: "edit_confirmation_required" });
    }

    // ---- write ----
    let created = 0;
    let edited = 0;
    for (const e of entries) {
      const old = existingByStudent.get(e.studentId);
      if (!old) {
        await checkingRepo.insertCheck(
          { checkDate: date, studentId: e.studentId, roomNumberSnapshot: room.roomNumber, status: e.status, stars: e.stars, note: e.note },
          tx,
        );
        created++;
      } else if (checkChanged(old, e)) {
        await checkingRepo.updateCheck(
          old.id,
          { status: e.status, stars: e.stars, note: e.note, revision: old.revision + 1, lastEditedAt: new Date() },
          tx,
        );
        edited++;
      }
    }
    const change: Parameters<typeof checkingRepo.upsertRoomState>[2] = {};
    if (commonNote !== undefined) change.commonNote = commonNote;
    if (state?.isVacant) change.isVacant = false; // checks were recorded, so the room is not vacant today
    if (Object.keys(change).length || !state) await checkingRepo.upsertRoomState(date, roomId, change, tx);

    const dayAfter = await buildDay(date, tx);
    return {
      created,
      edited,
      status: dayAfter.find((r) => r.id === roomId)?.status ?? ("pending" as RoomStatus),
      nextRoomNumber: nextPendingRoom(dayAfter, roomId)?.roomNumber ?? null,
    };
  });
}

// ---------------- Vacant / manual complete ----------------
async function setFlag(roomId: string, apply: (tx: DbOrTx, date: string) => Promise<void>) {
  const date = checkingDate();
  return getDb().transaction(async (tx) => {
    const room = await roomsRepo.findRoomForUpdate(roomId, tx);
    if (!room || !room.isActive) throw new DomainError("not_found", "Room not found.");
    await apply(tx, date);
    const day = await buildDay(date, tx);
    return {
      status: day.find((r) => r.id === roomId)?.status ?? ("pending" as RoomStatus),
      nextRoomNumber: nextPendingRoom(day, roomId)?.roomNumber ?? null,
    };
  });
}

/** The Warden marks a room vacant manually, each day. Nothing is carried over from yesterday. */
export function setRoomVacant(roomId: string, isVacant: boolean) {
  return setFlag(roomId, async (tx, date) => {
    if (isVacant) {
      if ((await checkingRepo.countRoomChecks(date, roomId, tx)) > 0) {
        throw new DomainError("conflict", "This room already has saved checks today, so it cannot be marked vacant.");
      }
      await checkingRepo.upsertRoomState(date, roomId, { isVacant: true, isManuallyComplete: false }, tx);
    } else {
      await checkingRepo.upsertRoomState(date, roomId, { isVacant: false }, tx);
    }
  });
}

/** Manual "Room Complete" (the room also turns green on its own once all active students are saved). */
export function setRoomComplete(roomId: string, isComplete: boolean) {
  return setFlag(roomId, async (tx, date) => {
    await checkingRepo.upsertRoomState(
      date,
      roomId,
      isComplete ? { isManuallyComplete: true, isVacant: false } : { isManuallyComplete: false },
      tx,
    );
  });
}

/** Today's status of every active room (used by Warden search). */
export const listRoomDays = () => buildDay(checkingDate(), getDb());
