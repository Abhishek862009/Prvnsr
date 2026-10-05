export type CheckStatus = "present" | "absent" | "other";

export type RawCheckEntry = {
  studentId: string;
  status?: string | null;
  stars?: number | null;
  note?: string | null;
};

export type CheckEntry = { studentId: string; status: CheckStatus; stars: number | null; note: string };

export const NOTE_MAX = 1000;

const STATUSES: readonly string[] = ["present", "absent", "other"];

/**
 * Locked rules:
 *  Present -> 1-5 stars REQUIRED, note optional
 *  Absent  -> no stars, note optional
 *  Other   -> no stars, note REQUIRED
 */
export function validateCheckEntry(
  raw: RawCheckEntry,
): { ok: true; value: CheckEntry } | { ok: false; errors: { field: string; message: string }[] } {
  const errors: { field: string; message: string }[] = [];
  const note = (raw.note ?? "").trim();
  const status = raw.status ?? "";

  if (!STATUSES.includes(status)) {
    errors.push({ field: "status", message: "Status must be Present, Absent or Other." });
    return { ok: false, errors };
  }
  if (note.length > NOTE_MAX) errors.push({ field: "note", message: `Note must be at most ${NOTE_MAX} characters.` });

  const stars = raw.stars ?? null;
  if (status === "present") {
    if (stars === null || !Number.isInteger(stars) || stars < 1 || stars > 5) {
      errors.push({ field: "stars", message: "Give 1 to 5 stars for a Present student." });
    }
  } else if (stars !== null) {
    errors.push({ field: "stars", message: "Stars can only be given to Present students." });
  }
  if (status === "other" && note === "") errors.push({ field: "note", message: "A note is required when status is Other." });

  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { studentId: raw.studentId, status: status as CheckStatus, stars, note } };
}

export const checkChanged = (
  existing: { status: string; stars: number | null; note: string },
  next: CheckEntry,
): boolean => existing.status !== next.status || existing.stars !== next.stars || existing.note !== next.note;
