import { parseCsv, CsvError } from "./csv";
import { normHeader, type RowError } from "./import-plan";
import { ROOM_IMPORT_COLUMNS, ROOM_IMPORT_LIMITS } from "./room-import-format";
import { MAX_ROOM_CAPACITY, deriveFloor } from "./rooms";
import { isSampleRoomNumber } from "./sample-data";
import { ROOM_NUMBER_PATTERN } from "./student-fields";

/**
 * Explicit modes prevent accidental overwrites:
 *  - "create": every room number must be NEW. An existing number is an error.
 *  - "update": every room number must EXIST. Only capacity can change. Unknown numbers are errors.
 */
export type RoomImportMode = "create" | "update";

export type RoomImportSnapshot = {
  rooms: { id: string; roomNumber: string; capacity: number; isActive: boolean; activeStudents: number }[];
};

export type PlannedRoomRow = {
  rowNumber: number;
  action: "create" | "update" | "unchanged" | "error";
  roomNumber: string;
  floor: number | null;
  capacity: number | null;
  roomId: string | null;
  errors: RowError[];
};

export type RoomImportPlan = {
  mode: RoomImportMode;
  fileErrors: string[];
  rows: PlannedRoomRow[];
  summary: { total: number; create: number; update: number; unchanged: number; errors: number };
  /** True only when every row is valid and at least one room will change. */
  canCommit: boolean;
};

export type ParsedRoomImport = {
  fileErrors: string[];
  rows: { rowNumber: number; cells: Record<string, string> }[];
};

export function parseRoomImportCsv(text: string): ParsedRoomImport {
  let table: string[][];
  try {
    table = parseCsv(text);
  } catch (e) {
    if (e instanceof CsvError) return { fileErrors: [e.message], rows: [] };
    throw e;
  }
  const header = table[0];
  if (!header) return { fileErrors: ["The file is empty."], rows: [] };

  const fileErrors: string[] = [];
  const headers = header.map(normHeader);
  const known = new Set<string>(ROOM_IMPORT_COLUMNS.map((c) => c.column));
  const seen = new Set<string>();
  for (const h of headers) {
    if (!known.has(h)) fileErrors.push(`Unknown column "${h}". Download the sample CSV for the expected columns.`);
    else if (seen.has(h)) fileErrors.push(`Column "${h}" appears more than once.`);
    seen.add(h);
  }
  for (const c of ROOM_IMPORT_COLUMNS) {
    if (c.required && !seen.has(c.column)) fileErrors.push(`Required column "${c.column}" is missing.`);
  }
  const dataRows = table.slice(1);
  if (dataRows.length === 0) fileErrors.push("The file has no room rows.");
  if (dataRows.length > ROOM_IMPORT_LIMITS.maxRows) fileErrors.push(`Too many rows (max ${ROOM_IMPORT_LIMITS.maxRows} per import).`);

  const rows = dataRows.map((cells, i) => {
    const record: Record<string, string> = {};
    headers.forEach((h, idx) => {
      record[h] = cells[idx] ?? "";
    });
    return { rowNumber: i + 2, cells: record };
  });
  return { fileErrors, rows };
}

export function planRoomImport(
  parsed: ParsedRoomImport,
  snapshot: RoomImportSnapshot,
  mode: RoomImportMode,
  options: { blockSampleData?: boolean } = {},
): RoomImportPlan {
  const empty = { total: parsed.rows.length, create: 0, update: 0, unchanged: 0, errors: 0 };
  if (parsed.fileErrors.length) {
    return { mode, fileErrors: [...parsed.fileErrors], rows: [], summary: empty, canCommit: false };
  }

  const existing = new Map(snapshot.rooms.map((r) => [r.roomNumber, r]));
  const rows: PlannedRoomRow[] = [];
  const numbersSeen = new Map<string, number[]>();

  for (const row of parsed.rows) {
    const roomNumber = (row.cells.room_number ?? "").trim();
    const p: PlannedRoomRow = { rowNumber: row.rowNumber, action: "error", roomNumber, floor: null, capacity: null, roomId: null, errors: [] };
    const err = (column: string, message: string) => p.errors.push({ column, message });
    rows.push(p);

    // room number
    if (!ROOM_NUMBER_PATTERN.test(roomNumber)) {
      err("room_number", roomNumber ? `"${roomNumber}" is not a valid room number (3 or 4 digits).` : "Room number is required.");
    } else {
      p.floor = deriveFloor(roomNumber);
      numbersSeen.set(roomNumber, [...(numbersSeen.get(roomNumber) ?? []), row.rowNumber]);
      if (options.blockSampleData && isSampleRoomNumber(roomNumber)) {
        err("room_number", "This is a sample room number and cannot be imported into production.");
      }
    }

    // capacity
    const capRaw = (row.cells.capacity ?? "").trim();
    if (!/^\d{1,2}$/.test(capRaw) || Number(capRaw) < 1 || Number(capRaw) > MAX_ROOM_CAPACITY) {
      err("capacity", `Capacity must be a whole number from 1 to ${MAX_ROOM_CAPACITY}.`);
    } else p.capacity = Number(capRaw);

    // optional floor must agree with the room number
    const floorRaw = (row.cells.floor ?? "").trim();
    if (floorRaw !== "" && p.floor !== null && String(Number(floorRaw)) !== String(p.floor)) {
      err("floor", `Floor ${floorRaw} does not match room ${roomNumber} (floor ${p.floor}). Leave it blank to auto-derive.`);
    }

    // create vs update, strictly by mode
    const found = existing.get(roomNumber);
    if (mode === "create") {
      if (found) err("room_number", `Room ${roomNumber} already exists. Use update mode to change its capacity.`);
    } else if (!found) {
      if (ROOM_NUMBER_PATTERN.test(roomNumber)) err("room_number", `Room ${roomNumber} does not exist. Use create mode to add it.`);
    } else {
      p.roomId = found.id;
      if (p.capacity !== null && p.capacity < found.activeStudents) {
        err("capacity", `Room ${roomNumber} has ${found.activeStudents} active student(s); capacity cannot be ${p.capacity}.`);
      }
    }
  }

  // duplicate room numbers inside the file
  for (const [num, nums] of numbersSeen) {
    if (nums.length < 2) continue;
    for (const p of rows) if (p.roomNumber === num) p.errors.push({ column: "room_number", message: `Room ${num} appears in rows ${nums.join(", ")}.` });
  }

  for (const p of rows) {
    if (p.errors.length) continue;
    if (mode === "create") p.action = "create";
    else p.action = existing.get(p.roomNumber)?.capacity === p.capacity ? "unchanged" : "update";
  }

  const count = (a: PlannedRoomRow["action"]) => rows.filter((r) => r.action === a).length;
  const summary = { total: rows.length, create: count("create"), update: count("update"), unchanged: count("unchanged"), errors: count("error") };
  return { mode, fileErrors: [], rows, summary, canCommit: summary.errors === 0 && summary.create + summary.update > 0 };
}
