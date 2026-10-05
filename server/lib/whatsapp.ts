import { formatDateLong } from "./dates";

/**
 * WhatsApp is MANUAL: the Warden taps a button, WhatsApp opens with the report pre-filled,
 * and the Warden presses Send himself. Nothing is sent automatically, and "Opened" only means
 * the button was tapped - it never means sent, delivered or read.
 */

export type ReportMessageInput = {
  date: string; // YYYY-MM-DD
  studentName: string;
  roomNumber: string;
  status: "present" | "absent" | "other";
  stars: number | null;
  note: string;
};

const STATUS_LABEL = { present: "Present", absent: "Absent", other: "Other" } as const;

/** Full report text: date, student, room, status, stars (Present only) and the Warden's note. */
export function buildReportMessage(r: ReportMessageInput): string {
  const lines = [
    "Varindavan Boys Hostel - Daily Report",
    `Date: ${formatDateLong(r.date)}`,
    `Student: ${r.studentName}`,
    `Room: ${r.roomNumber}`,
    `Status: ${STATUS_LABEL[r.status]}`,
  ];
  if (r.status === "present" && r.stars !== null) lines.push(`Stars: ${"⭐".repeat(r.stars)} ${r.stars}/5`);
  lines.push(`Note: ${r.note.trim() || "None"}`);
  return lines.join("\n");
}

/** wa.me wants the number as digits only (no "+") and the text URL-encoded. */
export function buildWhatsAppLink(e164: string, message: string): string {
  return `https://wa.me/${e164.replace(/^\+/, "")}?text=${encodeURIComponent(message)}`;
}

export const WHATSAPP_MISSING_REASON = "Parent WhatsApp number not available.";

const E164 = /^\+[1-9]\d{7,14}$/;

/** Only the PRIMARY parent number is ever used. A missing/invalid number disables the button. */
export function whatsappAvailability(
  primaryNumber: string | null | undefined,
): { available: true; e164: string } | { available: false; reason: string } {
  if (primaryNumber && E164.test(primaryNumber)) return { available: true, e164: primaryNumber };
  return { available: false, reason: WHATSAPP_MISSING_REASON };
}

export type WhatsAppState = "not_opened" | "opened" | "edited_after";

/**
 * Compares the report's current revision with the newest revision the Warden opened in WhatsApp:
 *  - never opened                              -> not_opened
 *  - opened the current revision               -> opened
 *  - opened an older revision (edited since)   -> edited_after  ("Edited after WhatsApp")
 */
export function whatsappState(checkRevision: number, openedRevisions: readonly number[]): WhatsAppState {
  if (openedRevisions.length === 0) return "not_opened";
  return Math.max(...openedRevisions) >= checkRevision ? "opened" : "edited_after";
}

/** The open that matters for display: highest revision, then the most recent click. */
export function latestOpen<T extends { revision: number; openedAt: Date }>(opens: readonly T[]): T | null {
  return opens.reduce<T | null>(
    (best, o) =>
      !best || o.revision > best.revision || (o.revision === best.revision && o.openedAt > best.openedAt) ? o : best,
    null,
  );
}

/** Reports that still need the Warden's attention for WhatsApp. */
export const needsWhatsApp = (state: WhatsAppState, available: boolean): boolean => available && state !== "opened";
