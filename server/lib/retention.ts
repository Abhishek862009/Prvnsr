import { CHECKING_HISTORY_DAYS, ENQUIRY_RETENTION_DAYS } from "../config/retention";
import { addDays, dateInZone } from "./dates";

/** Cleanup is strictly IST, independent of the server (UTC) clock and of APP_TIMEZONE. */
export const CLEANUP_TIMEZONE = "Asia/Kolkata";
const IST_OFFSET = "+05:30"; // India has no daylight saving

/** The instant at which the given IST calendar date starts (00:00 IST). */
export const istMidnight = (isoDate: string): Date => new Date(`${isoDate}T00:00:00${IST_OFFSET}`);

export type RetentionCutoffs = {
  /** Today's IST calendar date. */
  today: string;
  /** Oldest checking date that is KEPT (today and the 29 days before it = 30 calendar days). */
  checkingKeepFrom: string;
  /** Instants before this are deleted (acknowledgements, WhatsApp logs). Start of `checkingKeepFrom` in IST. */
  checkingCutoffInstant: Date;
  /** Oldest IST date an enquiry may have been received on and still be kept (90 calendar days). */
  enquiryKeepFrom: string;
  enquiryCutoffInstant: Date;
};

/**
 * "Older than 30 days" means: before the 30-calendar-day window that the Parent Portal shows
 * (today - 29 .. today). Enquiries use the same rule with 90 days. All boundaries are IST midnights,
 * so a 11:30 PM IST checking is never mistaken for the next UTC day.
 */
export function retentionCutoffs(now: Date): RetentionCutoffs {
  const today = dateInZone(now, CLEANUP_TIMEZONE);
  const checkingKeepFrom = addDays(today, -(CHECKING_HISTORY_DAYS - 1));
  const enquiryKeepFrom = addDays(today, -(ENQUIRY_RETENTION_DAYS - 1));
  return {
    today,
    checkingKeepFrom,
    checkingCutoffInstant: istMidnight(checkingKeepFrom),
    enquiryKeepFrom,
    enquiryCutoffInstant: istMidnight(enquiryKeepFrom),
  };
}

export type CleanupDataset = {
  dailyChecks: { id: string; checkDate: string }[];
  dailyRoomStates: { id: string; checkDate: string }[];
  acknowledgements: { id: string; dailyCheckId: string; acknowledgedAt: Date }[];
  deliveryLog: { id: string; dailyCheckId: string; openedAt: Date }[];
  enquiries: { id: string; createdAt: Date }[];
};

/**
 * Reference model of what the cleanup deletes. The SQL in server/repos/cleanup.ts implements the
 * same predicates, and deleting a check cascades to its acknowledgements and delivery logs.
 * Rooms, students, parent accounts/links, settings and the Warden account are NOT part of it.
 */
export function planCleanup(data: CleanupDataset, now: Date) {
  const c = retentionCutoffs(now);
  const oldChecks = new Set(data.dailyChecks.filter((x) => x.checkDate < c.checkingKeepFrom).map((x) => x.id));
  return {
    cutoffs: c,
    dailyChecks: [...oldChecks],
    dailyRoomStates: data.dailyRoomStates.filter((x) => x.checkDate < c.checkingKeepFrom).map((x) => x.id),
    acknowledgements: data.acknowledgements
      .filter((x) => x.acknowledgedAt < c.checkingCutoffInstant || oldChecks.has(x.dailyCheckId))
      .map((x) => x.id),
    deliveryLog: data.deliveryLog
      .filter((x) => x.openedAt < c.checkingCutoffInstant || oldChecks.has(x.dailyCheckId))
      .map((x) => x.id),
    enquiries: data.enquiries.filter((x) => x.createdAt < c.enquiryCutoffInstant).map((x) => x.id),
  };
}
