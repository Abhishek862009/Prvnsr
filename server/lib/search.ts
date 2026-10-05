import { compareRoomNumbers } from "./room-status";

export type SearchQuery = { kind: "empty" } | { kind: "room"; text: string } | { kind: "name"; text: string };

/**
 * Warden search. The Warden remembers ROOM NUMBERS, so digits are treated as a room number first;
 * anything else is a student name / code.
 */
export function classifyQuery(input: string): SearchQuery {
  const text = String(input ?? "").trim().slice(0, 60);
  if (!text) return { kind: "empty" };
  return /^\d{1,4}$/.test(text) ? { kind: "room", text } : { kind: "name", text };
}

/** Exact room first, then rooms starting with the digits, in room order. */
export function matchRoomPrefix<T extends { roomNumber: string }>(rooms: readonly T[], prefix: string, limit = 20): T[] {
  const exact = rooms.filter((r) => r.roomNumber === prefix);
  const starts = rooms.filter((r) => r.roomNumber !== prefix && r.roomNumber.startsWith(prefix)).sort((a, b) => compareRoomNumbers(a.roomNumber, b.roomNumber));
  return [...exact, ...starts].slice(0, limit);
}
