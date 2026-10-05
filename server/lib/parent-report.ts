import { addDays } from "./dates";

// ---------------- Acknowledgement (uses the daily check `revision`) ----------------
export type AckState = "none" | "acknowledged" | "updated";

/**
 * The parent acknowledged revision N of a report.
 *  - never acknowledged                       -> "none"        (show Acknowledge / Seen)
 *  - acknowledged revision >= current         -> "acknowledged"
 *  - acknowledged an OLDER revision (note/status/stars edited since) -> "updated"
 *    (show "Updated — Please acknowledge again")
 */
export function ackState(checkRevision: number, ackRevision: number | null | undefined): AckState {
  if (ackRevision === null || ackRevision === undefined) return "none";
  return ackRevision >= checkRevision ? "acknowledged" : "updated";
}

/** Warden's view across every parent account linked to the student. */
export function summarizeAcks(
  checkRevision: number,
  acks: readonly { revision: number; acknowledgedAt: Date }[],
): { state: AckState; at: Date | null } {
  const latest = (list: readonly { acknowledgedAt: Date }[]) =>
    list.reduce<Date | null>((best, a) => (!best || a.acknowledgedAt > best ? a.acknowledgedAt : best), null);
  const current = acks.filter((a) => a.revision >= checkRevision);
  if (current.length) return { state: "acknowledged", at: latest(current) };
  if (acks.length) return { state: "updated", at: latest(acks) };
  return { state: "none", at: null };
}

// ---------------- Stars ----------------
/** Average is always calculated from records (never stored). Only rated Present days count. */
export function starSummary(rows: readonly { status: string; stars: number | null }[]): {
  average: number | null;
  ratedDays: number;
} {
  const rated = rows.filter((r) => r.status === "present" && r.stars !== null) as { stars: number }[];
  if (rated.length === 0) return { average: null, ratedDays: 0 };
  const sum = rated.reduce((total, r) => total + r.stars, 0);
  return { average: Math.round((sum / rated.length) * 10) / 10, ratedDays: rated.length };
}

export type TrendPoint = { date: string; stars: number | null };

/** One point per calendar day from..to (inclusive); days without a rating have stars = null. */
export function buildTrend(
  rows: readonly { date: string; status: string; stars: number | null }[],
  from: string,
  to: string,
): TrendPoint[] {
  const byDate = new Map(rows.map((r) => [r.date, r.status === "present" ? r.stars : null]));
  const points: TrendPoint[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) points.push({ date: d, stars: byDate.get(d) ?? null });
  return points;
}

// ---------------- What a parent may see ----------------
export type AccessWindow = {
  /** False once the student is inactive: current/new reports are hidden. */
  currentReportsAllowed: boolean;
  historyFrom: string;
  historyTo: string | null;
};

export type HistoryRange = "7" | "30" | "all";

export function parseRange(value: string | null | undefined): HistoryRange {
  return value === "7" || value === "30" || value === "all" ? value : "30";
}

/** Date window for a filter, never wider than what the student's access allows. */
export function rangeBounds(range: HistoryRange, w: AccessWindow, today: string): { from: string; to: string | null } {
  const wanted = range === "7" ? addDays(today, -6) : range === "30" ? addDays(today, -29) : w.historyFrom;
  return { from: wanted > w.historyFrom ? wanted : w.historyFrom, to: w.historyTo };
}

/**
 * Single rule for every report a parent reads or acknowledges:
 * inside the retained history window, not after deactivation, and for an inactive student
 * never today's (current) report.
 */
export function isReportDateAccessible(w: AccessWindow, date: string, today: string): boolean {
  if (date < w.historyFrom) return false;
  if (w.historyTo !== null && date > w.historyTo) return false;
  if (date === today && !w.currentReportsAllowed) return false;
  return true;
}
