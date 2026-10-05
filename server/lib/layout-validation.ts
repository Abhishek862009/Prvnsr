import type { FloorLayout } from "@/layouts/types";
import { deriveFloor } from "./rooms";

export type LayoutIssues = {
  /** Structural problems: the layout cannot be trusted, so the UI falls back to a plain room grid. */
  errors: string[];
  /** Mismatches with the database; rooms not in the layout are shown in an "Other rooms" list. */
  warnings: string[];
};

const overlaps = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Pure check of one floor plan against the active room numbers of that floor. */
export function validateLayout(layout: FloorLayout, dbRoomNumbers: readonly string[]): LayoutIssues {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (layout.width <= 0 || layout.height <= 0) errors.push("Canvas size must be positive.");

  const seen = new Set<string>();
  for (const r of layout.rooms) {
    if (seen.has(r.roomNumber)) errors.push(`Room ${r.roomNumber} appears twice in the layout.`);
    seen.add(r.roomNumber);
    if (deriveFloor(r.roomNumber) !== layout.floor) errors.push(`Room ${r.roomNumber} does not belong to floor ${layout.floor}.`);
    if (r.w <= 0 || r.h <= 0) errors.push(`Room ${r.roomNumber} has no size.`);
    if (r.x < 0 || r.y < 0 || r.x + r.w > layout.width || r.y + r.h > layout.height) {
      errors.push(`Room ${r.roomNumber} is outside the canvas.`);
    }
  }
  for (let i = 0; i < layout.rooms.length; i++) {
    for (let j = i + 1; j < layout.rooms.length; j++) {
      const a = layout.rooms[i];
      const b = layout.rooms[j];
      if (a && b && overlaps(a, b)) errors.push(`Rooms ${a.roomNumber} and ${b.roomNumber} overlap.`);
    }
  }

  const db = new Set(dbRoomNumbers);
  for (const n of seen) if (!db.has(n)) warnings.push(`Layout room ${n} is not an active room in the database.`);
  for (const n of db) if (!seen.has(n)) warnings.push(`Active room ${n} is missing from the floor ${layout.floor} layout.`);

  return { errors, warnings };
}
