export const DEFAULT_TIMEZONE = "Asia/Kolkata";

/** Calendar date (YYYY-MM-DD) in the given timezone. Checking runs until ~11 PM IST, so never use UTC dates. */
export function dateInZone(at: Date, timeZone: string = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

export function todayInZone(timeZone: string = DEFAULT_TIMEZONE, now: Date = new Date()): string {
  return dateInZone(now, timeZone);
}

/** Add whole days to a YYYY-MM-DD string (calendar arithmetic, no timezone involved). */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (y === undefined || m === undefined || d === undefined) throw new Error("Invalid date");
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** "Wednesday, 1 October 2026" for a YYYY-MM-DD string. */
export function formatDateLong(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString("en-IN", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** "Wed, 1 Oct" for a YYYY-MM-DD string. */
export function formatDateShort(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString("en-IN", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** "1 Oct, 7:42 pm" for an instant, shown in the hostel's timezone. */
export function formatDateTimeInZone(at: Date, timeZone: string = DEFAULT_TIMEZONE): string {
  return at.toLocaleString("en-IN", { timeZone, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}
