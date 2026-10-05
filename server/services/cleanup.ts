import { getDb } from "@/server/db/client";
import { CLEANUP_TIMEZONE, retentionCutoffs } from "@/server/lib/retention";
import { deleteExpired } from "@/server/repos/cleanup";

/**
 * Daily cleanup (called by the protected cron endpoint). Strictly IST: the cutoffs come from
 * `retentionCutoffs`, never from the server's UTC date. One transaction: all five deletions or none.
 */
export async function runCleanup(now: Date = new Date()) {
  const c = retentionCutoffs(now);
  const deleted = await getDb().transaction((tx) => deleteExpired(tx, c));
  return {
    ranAt: now.toISOString(),
    timezone: CLEANUP_TIMEZONE,
    today: c.today,
    keptCheckingFrom: c.checkingKeepFrom,
    keptEnquiriesFrom: c.enquiryKeepFrom,
    deleted,
  };
}
