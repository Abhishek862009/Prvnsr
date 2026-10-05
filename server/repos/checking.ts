import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb, type DbOrTx } from "@/server/db/client";
import { dailyChecks, dailyRoomStates, rooms, students } from "@/server/db/schema";

/** Everything needed to derive today's room statuses. A hostel is small, so one cheap read. */
export async function loadDayData(date: string, dbx: DbOrTx = getDb()) {
  const [roomRows, studentRows, checkRows, stateRows] = await Promise.all([
    dbx
      .select({ id: rooms.id, roomNumber: rooms.roomNumber, floor: rooms.floor, capacity: rooms.capacity })
      .from(rooms)
      .where(eq(rooms.isActive, true))
      .orderBy(asc(rooms.floor), asc(rooms.roomNumber)),
    dbx.select({ id: students.id, roomId: students.roomId }).from(students).where(eq(students.isActive, true)),
    dbx.select({ studentId: dailyChecks.studentId }).from(dailyChecks).where(eq(dailyChecks.checkDate, date)),
    dbx
      .select({
        roomId: dailyRoomStates.roomId,
        isVacant: dailyRoomStates.isVacant,
        isManuallyComplete: dailyRoomStates.isManuallyComplete,
        commonNote: dailyRoomStates.commonNote,
      })
      .from(dailyRoomStates)
      .where(eq(dailyRoomStates.checkDate, date)),
  ]);
  return { rooms: roomRows, students: studentRows, checkedStudentIds: checkRows.map((c) => c.studentId), states: stateRows };
}

export async function getRoomState(date: string, roomId: string, dbx: DbOrTx = getDb()) {
  const [row] = await dbx
    .select()
    .from(dailyRoomStates)
    .where(and(eq(dailyRoomStates.checkDate, date), eq(dailyRoomStates.roomId, roomId)))
    .limit(1);
  return row ?? null;
}

type StateChange = Partial<{ isVacant: boolean; isManuallyComplete: boolean; commonNote: string }>;

/** Creates today's state row for the room, or updates only the fields given. */
export async function upsertRoomState(date: string, roomId: string, change: StateChange, dbx: DbOrTx = getDb()) {
  const insert = dbx.insert(dailyRoomStates).values({ checkDate: date, roomId, ...change });
  if (Object.keys(change).length === 0) {
    await insert.onConflictDoNothing();
    return;
  }
  await insert.onConflictDoUpdate({ target: [dailyRoomStates.checkDate, dailyRoomStates.roomId], set: change });
}

/** Roster changed (move-in / new / reactivated student): vacant and manual-complete no longer apply today. */
export async function clearRoomFlags(roomId: string, date: string, dbx: DbOrTx = getDb()) {
  await dbx
    .update(dailyRoomStates)
    .set({ isVacant: false, isManuallyComplete: false })
    .where(and(eq(dailyRoomStates.checkDate, date), eq(dailyRoomStates.roomId, roomId)));
}

export async function listChecksForStudents(date: string, studentIds: string[], dbx: DbOrTx = getDb()) {
  if (studentIds.length === 0) return [];
  return dbx
    .select()
    .from(dailyChecks)
    .where(and(eq(dailyChecks.checkDate, date), inArray(dailyChecks.studentId, studentIds)));
}

export async function insertCheck(
  values: { checkDate: string; studentId: string; roomNumberSnapshot: string; status: "present" | "absent" | "other"; stars: number | null; note: string },
  dbx: DbOrTx = getDb(),
) {
  await dbx.insert(dailyChecks).values({ ...values, revision: 1 });
}

export async function updateCheck(
  id: string,
  set: { status: "present" | "absent" | "other"; stars: number | null; note: string; revision: number; lastEditedAt: Date },
  dbx: DbOrTx = getDb(),
) {
  await dbx.update(dailyChecks).set(set).where(eq(dailyChecks.id, id));
}

/** Saved checks today for students currently active in this room. */
export async function countRoomChecks(date: string, roomId: string, dbx: DbOrTx = getDb()) {
  const rows = await dbx
    .select({ id: dailyChecks.id })
    .from(dailyChecks)
    .innerJoin(students, eq(students.id, dailyChecks.studentId))
    .where(and(eq(dailyChecks.checkDate, date), eq(students.roomId, roomId), eq(students.isActive, true)));
  return rows.length;
}
