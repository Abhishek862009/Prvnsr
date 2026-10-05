import { toCsv } from "./csv";
import { SAMPLE_ROOM_NUMBERS } from "./sample-data";

export const ROOM_IMPORT_COLUMNS = [
  { column: "room_number", required: true },
  { column: "capacity", required: true },
  { column: "floor", required: false }, // optional; must match the floor derived from the room number
] as const;

export const ROOM_IMPORT_LIMITS = { maxRows: 500, maxBytes: 200_000 } as const;

/** Sample rooms use reserved numbers (9001-9003) that production refuses to import. */
export function sampleRoomImportCsv(): string {
  const [a, b, c] = SAMPLE_ROOM_NUMBERS;
  return toCsv([
    ROOM_IMPORT_COLUMNS.map((x) => x.column),
    [a, "1", "90"],
    [b, "2", ""],
    [c, "2", ""],
  ]);
}
