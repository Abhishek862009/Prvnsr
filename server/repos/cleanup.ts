import { inArray, lt, or } from "drizzle-orm";
import type { Tx } from "@/server/db/client";
import { acknowledgements, dailyChecks, dailyRoomStates, deliveryLog, enquiries } from "@/server/db/schema";
import type { RetentionCutoffs } from "@/server/lib/retention";

/**
 * Deletes ONLY the five temporary categories. Rooms, students, parent accounts, links, settings
 * and the Warden account are never referenced here. Predicates match `planCleanup` in lib/retention.ts.
 */
export async function deleteExpired(tx: Tx, c: RetentionCutoffs) {
  const oldChecks = tx.select({ id: dailyChecks.id }).from(dailyChecks).where(lt(dailyChecks.checkDate, c.checkingKeepFrom));

  const acks = await tx
    .delete(acknowledgements)
    .where(or(lt(acknowledgements.acknowledgedAt, c.checkingCutoffInstant), inArray(acknowledgements.dailyCheckId, oldChecks)))
    .returning({ id: acknowledgements.id });
  const logs = await tx
    .delete(deliveryLog)
    .where(or(lt(deliveryLog.openedAt, c.checkingCutoffInstant), inArray(deliveryLog.dailyCheckId, oldChecks)))
    .returning({ id: deliveryLog.id });
  const states = await tx.delete(dailyRoomStates).where(lt(dailyRoomStates.checkDate, c.checkingKeepFrom)).returning({ id: dailyRoomStates.id });
  const checks = await tx.delete(dailyChecks).where(lt(dailyChecks.checkDate, c.checkingKeepFrom)).returning({ id: dailyChecks.id });
  const enq = await tx.delete(enquiries).where(lt(enquiries.createdAt, c.enquiryCutoffInstant)).returning({ id: enquiries.id });

  return {
    dailyChecks: checks.length,
    dailyRoomStates: states.length,
    acknowledgements: acks.length,
    deliveryLog: logs.length,
    enquiries: enq.length,
  };
}
