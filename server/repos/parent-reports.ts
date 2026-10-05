import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { getDb, type DbOrTx } from "@/server/db/client";
import { acknowledgements, dailyChecks, dailyRoomStates, rooms } from "@/server/db/schema";

/**
 * A student's daily reports in a date window, newest first, with:
 *  - the room note for that day (room matched by the snapshot room number), and
 *  - THIS parent's acknowledgement (revision + time), if any.
 * The caller has already proven that the parent is linked to the student.
 */
export async function listStudentReports(
  args: { parentId: string; studentId: string; from: string; to: string | null },
  dbx: DbOrTx = getDb(),
) {
  return dbx
    .select({
      id: dailyChecks.id,
      date: dailyChecks.checkDate,
      roomNumber: dailyChecks.roomNumberSnapshot,
      status: dailyChecks.status,
      stars: dailyChecks.stars,
      note: dailyChecks.note,
      revision: dailyChecks.revision,
      lastEditedAt: dailyChecks.lastEditedAt,
      roomNote: dailyRoomStates.commonNote,
      ackRevision: acknowledgements.revision,
      acknowledgedAt: acknowledgements.acknowledgedAt,
    })
    .from(dailyChecks)
    .leftJoin(rooms, eq(rooms.roomNumber, dailyChecks.roomNumberSnapshot))
    .leftJoin(dailyRoomStates, and(eq(dailyRoomStates.checkDate, dailyChecks.checkDate), eq(dailyRoomStates.roomId, rooms.id)))
    .leftJoin(acknowledgements, and(eq(acknowledgements.dailyCheckId, dailyChecks.id), eq(acknowledgements.parentId, args.parentId)))
    .where(
      and(
        eq(dailyChecks.studentId, args.studentId),
        gte(dailyChecks.checkDate, args.from),
        args.to ? lte(dailyChecks.checkDate, args.to) : undefined,
      ),
    )
    .orderBy(desc(dailyChecks.checkDate));
}

export async function findCheckById(id: string, dbx: DbOrTx = getDb()) {
  const [row] = await dbx
    .select({ id: dailyChecks.id, studentId: dailyChecks.studentId, date: dailyChecks.checkDate, revision: dailyChecks.revision })
    .from(dailyChecks)
    .where(eq(dailyChecks.id, id))
    .limit(1);
  return row ?? null;
}

/** Records (or refreshes) the parent's acknowledgement of exactly this revision. */
export async function upsertAcknowledgement(
  args: { dailyCheckId: string; parentId: string; revision: number },
  dbx: DbOrTx = getDb(),
) {
  const now = new Date();
  await dbx
    .insert(acknowledgements)
    .values({ ...args, acknowledgedAt: now })
    .onConflictDoUpdate({
      target: [acknowledgements.dailyCheckId, acknowledgements.parentId],
      set: { revision: args.revision, acknowledgedAt: now },
    });
  return now;
}

/** For the Warden: every parent acknowledgement of the given checks. */
export async function listAcknowledgementsForChecks(checkIds: string[], dbx: DbOrTx = getDb()) {
  if (checkIds.length === 0) return [];
  return dbx
    .select({
      dailyCheckId: acknowledgements.dailyCheckId,
      parentId: acknowledgements.parentId,
      revision: acknowledgements.revision,
      acknowledgedAt: acknowledgements.acknowledgedAt,
    })
    .from(acknowledgements)
    .where(inArray(acknowledgements.dailyCheckId, checkIds));
}
