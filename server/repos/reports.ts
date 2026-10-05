import { and, eq, inArray } from "drizzle-orm";
import { getDb, type DbOrTx } from "@/server/db/client";
import { dailyChecks, deliveryLog, students } from "@/server/db/schema";

/** Every check saved for the date, with what the Warden needs to contact the parent. */
export async function listChecksForDate(date: string, dbx: DbOrTx = getDb()) {
  return dbx
    .select({
      id: dailyChecks.id,
      studentId: dailyChecks.studentId,
      studentName: students.name,
      roomNumber: dailyChecks.roomNumberSnapshot,
      status: dailyChecks.status,
      stars: dailyChecks.stars,
      note: dailyChecks.note,
      revision: dailyChecks.revision,
      lastEditedAt: dailyChecks.lastEditedAt,
      parentWhatsapp: students.parentWhatsapp, // PRIMARY parent number only
    })
    .from(dailyChecks)
    .innerJoin(students, eq(students.id, dailyChecks.studentId))
    .where(eq(dailyChecks.checkDate, date));
}

export async function listWhatsappOpens(checkIds: string[], dbx: DbOrTx = getDb()) {
  if (checkIds.length === 0) return [];
  return dbx
    .select({ dailyCheckId: deliveryLog.dailyCheckId, revision: deliveryLog.revision, openedAt: deliveryLog.openedAt })
    .from(deliveryLog)
    .where(and(inArray(deliveryLog.dailyCheckId, checkIds), eq(deliveryLog.channel, "whatsapp")));
}

export async function findCheckForDelivery(id: string, dbx: DbOrTx = getDb()) {
  const [row] = await dbx
    .select({ id: dailyChecks.id, date: dailyChecks.checkDate, revision: dailyChecks.revision })
    .from(dailyChecks)
    .where(eq(dailyChecks.id, id))
    .limit(1);
  return row ?? null;
}

/** One row per button tap: which report revision the Warden opened, and when. */
export async function insertWhatsappOpen(args: { dailyCheckId: string; revision: number }, dbx: DbOrTx = getDb()) {
  const [row] = await dbx
    .insert(deliveryLog)
    .values({ dailyCheckId: args.dailyCheckId, channel: "whatsapp", revision: args.revision })
    .returning({ openedAt: deliveryLog.openedAt });
  return row ?? null;
}
