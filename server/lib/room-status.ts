export type RoomStatus = "pending" | "complete" | "vacant";

/** Numeric room order (101 < 102 < 1001), falling back to text for odd values. */
export function compareRoomNumbers(a: string, b: string): number {
  const na = Number(a);
  const nb = Number(b);
  return Number.isNaN(na) || Number.isNaN(nb) ? a.localeCompare(b) : na - nb;
}

/**
 * Daily room status, always derived from saved records (never stored):
 *  - marked vacant today            -> vacant (grey)
 *  - manual Room Complete           -> complete (green)
 *  - >= 1 active student, and every active student has a record today -> complete (green)
 *  - everything else, including a room with 0 active students -> pending (red)
 */
export function deriveRoomStatus(input: {
  isVacant: boolean;
  isManuallyComplete: boolean;
  activeStudentIds: readonly string[];
  checkedStudentIds: ReadonlySet<string>;
}): RoomStatus {
  if (input.isVacant) return "vacant";
  if (input.isManuallyComplete) return "complete";
  const { activeStudentIds, checkedStudentIds } = input;
  if (activeStudentIds.length > 0 && activeStudentIds.every((id) => checkedStudentIds.has(id))) return "complete";
  return "pending";
}

export type Progress = { total: number; completed: number; pending: number; vacant: number };

const emptyProgress = (): Progress => ({ total: 0, completed: 0, pending: 0, vacant: 0 });

function add(p: Progress, status: RoomStatus) {
  p.total++;
  if (status === "complete") p.completed++;
  else if (status === "vacant") p.vacant++;
  else p.pending++;
}

/** Overall + floor-wise counts, e.g. 18 completed / 20 pending / 2 vacant of 40. */
export function summarizeProgress(rooms: readonly { floor: number; status: RoomStatus }[]) {
  const overall = emptyProgress();
  const byFloor = new Map<number, Progress>();
  for (const r of rooms) {
    add(overall, r.status);
    const fp = byFloor.get(r.floor) ?? emptyProgress();
    add(fp, r.status);
    byFloor.set(r.floor, fp);
  }
  const floors = [...byFloor.entries()].sort((a, b) => a[0] - b[0]).map(([floor, p]) => ({ floor, ...p }));
  return { overall, floors };
}

/** First room (in order) that still needs checking. Used by "Continue from Room ...". */
export function firstPendingRoom<T extends { status: RoomStatus }>(ordered: readonly T[]): T | null {
  return ordered.find((r) => r.status === "pending") ?? null;
}

/**
 * Room to open after "Save & Next Room": the next pending room after the current one in
 * sequence, wrapping around to earlier rooms. Complete and vacant rooms are skipped.
 */
export function nextPendingRoom<T extends { id: string; status: RoomStatus }>(
  ordered: readonly T[],
  currentId: string,
): T | null {
  const i = ordered.findIndex((r) => r.id === currentId);
  const after = i < 0 ? ordered : ordered.slice(i + 1);
  const before = i < 0 ? [] : ordered.slice(0, i);
  return [...after, ...before].find((r) => r.status === "pending" && r.id !== currentId) ?? null;
}
