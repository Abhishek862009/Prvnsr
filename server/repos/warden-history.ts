import { and, desc, eq, gte, lte } from "drizzle-orm";
import { getDb, type DbOrTx } from "@/server/db/client";
import { dailyChecks, dailyRoomStates, rooms, students } from "@/server/db/schema";

/**
 * Warden history rows for a date window (the room note is matched through the room number the check
 * was saved under, exactly like the Parent Portal does). Filters other than the date window are applied
 * in memory by `filterHistory`, so they are unit-tested; at hostel scale (<= ~4,000 rows) this is cheap.
 */
export async function listHistoryRows(range: { from: string; to: string }, dbx: DbOrTx = getDb()) {
  return dbx
    .select({
      id: dailyChecks.id,
      date: dailyChecks.checkDate,
      studentId: students.id,
      studentName: students.name,
      studentCode: students.studentCode,
      studentActive: students.isActive,
      roomNumber: dailyChecks.roomNumberSnapshot,
      status: dailyChecks.status,
      stars: dailyChecks.stars,
      note: dailyChecks.note,
      revision: dailyChecks.revision,
      lastEditedAt: dailyChecks.lastEditedAt,
      roomNote: dailyRoomStates.commonNote,
    })
    .from(dailyChecks)
    .innerJoin(students, eq(students.id, dailyChecks.studentId))
    .leftJoin(rooms, eq(rooms.roomNumber, dailyChecks.roomNumberSnapshot))
    .leftJoin(dailyRoomStates, and(eq(dailyRoomStates.checkDate, dailyChecks.checkDate), eq(dailyRoomStates.roomId, rooms.id)))
    .where(and(gte(dailyChecks.checkDate, range.from), lte(dailyChecks.checkDate, range.to)))
    .orderBy(desc(dailyChecks.checkDate))
    .limit(6000);
}
