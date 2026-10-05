import { parseCsv, CsvError } from "./csv";
import { FIELD_TO_COLUMN, IMPORT_COLUMNS, IMPORT_LIMITS } from "./import-format";
import { looksLikeSampleStudent } from "./sample-data";
import { ROOM_NUMBER_PATTERN, validateStudentFields, type RawStudentFields, type StudentFields } from "./student-fields";

export type ImportSnapshot = {
  rooms: { id: string; roomNumber: string; capacity: number; isActive: boolean }[];
  students: {
    id: string;
    studentCode: string | null;
    name: string;
    roomId: string;
    isActive: boolean;
    parentWhatsapp: string | null;
  }[];
};

export type RowError = { column: string; message: string };

export type PlannedRow = {
  rowNumber: number; // spreadsheet row (header = row 1)
  action: "create" | "update" | "error";
  studentId: string | null;
  roomId: string | null;
  fields: StudentFields | null;
  errors: RowError[];
};

export type ImportPlan = {
  fileErrors: string[];
  rows: PlannedRow[];
  summary: { total: number; create: number; update: number; errors: number };
  /** True only when the file is fully valid. A plan with any error is never applied. */
  canCommit: boolean;
};

export type ParsedImport = {
  fileErrors: string[];
  rows: { rowNumber: number; cells: Record<string, string> }[];
};

export const normHeader = (h: string) => h.trim().toLowerCase().replace(/[\s-]+/g, "_");

export function parseImportCsv(text: string): ParsedImport {
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
  const known = new Set<string>(IMPORT_COLUMNS.map((c) => c.column));

  const seen = new Set<string>();
  for (const h of headers) {
    if (!known.has(h)) fileErrors.push(`Unknown column "${h}". Download the sample CSV for the expected columns.`);
    else if (seen.has(h)) fileErrors.push(`Column "${h}" appears more than once.`);
    seen.add(h);
  }
  for (const c of IMPORT_COLUMNS) {
    if (c.required && !seen.has(c.column)) fileErrors.push(`Required column "${c.column}" is missing.`);
  }

  const dataRows = table.slice(1);
  if (dataRows.length === 0) fileErrors.push("The file has no student rows.");
  if (dataRows.length > IMPORT_LIMITS.maxRows) fileErrors.push(`Too many rows (max ${IMPORT_LIMITS.maxRows} per import).`);

  const rows = dataRows.map((cells, i) => {
    const record: Record<string, string> = {};
    headers.forEach((h, idx) => {
      record[h] = cells[idx] ?? "";
    });
    return { rowNumber: i + 2, cells: record };
  });
  return { fileErrors, rows };
}

const keyOf = (name: string, roomId: string, whatsapp: string) => `${name.trim().toLowerCase()}|${roomId}|${whatsapp}`;

/**
 * Pure validation + planning. No database access, so the exact same logic runs for the
 * preview and again inside the commit transaction.
 */
export function planImport(
  parsed: ParsedImport,
  snapshot: ImportSnapshot,
  options: { blockSampleData?: boolean } = {},
): ImportPlan {
  const fileErrors = [...parsed.fileErrors];
  if (fileErrors.length) {
    return { fileErrors, rows: [], summary: { total: parsed.rows.length, create: 0, update: 0, errors: 0 }, canCommit: false };
  }

  const roomByNumber = new Map(snapshot.rooms.map((r) => [r.roomNumber, r]));
  const roomById = new Map(snapshot.rooms.map((r) => [r.id, r]));
  const studentById = new Map(snapshot.students.map((s) => [s.id, s]));
  const byCode = new Map<string, ImportSnapshot["students"][number]>();
  const existingKeys = new Map<string, string>();
  for (const s of snapshot.students) {
    if (s.studentCode) byCode.set(s.studentCode, s);
    if (s.parentWhatsapp) existingKeys.set(keyOf(s.name, s.roomId, s.parentWhatsapp), s.name);
  }

  const planned: (PlannedRow & { intent: "create" | "update" })[] = [];
  const addError = (p: PlannedRow, field: string, message: string) =>
    p.errors.push({ column: FIELD_TO_COLUMN[field] ?? field, message });

  // ---- Pass 1: per-row validation, room lookup, create-vs-update ----
  for (const row of parsed.rows) {
    const c = row.cells;
    const raw: RawStudentFields = {
      studentCode: c.student_code,
      name: c.name,
      parentName: c.parent_name,
      parentEmail: c.parent_email,
      parentWhatsapp: c.parent_whatsapp,
      secondaryName: c.secondary_name,
      secondaryEmail: c.secondary_email,
      secondaryWhatsapp: c.secondary_whatsapp,
      studentPhone: c.student_phone,
    };
    const p: PlannedRow & { intent: "create" | "update" } = {
      rowNumber: row.rowNumber,
      action: "error",
      intent: "create",
      studentId: null,
      roomId: null,
      fields: null,
      errors: [],
    };
    planned.push(p);

    const v = validateStudentFields(raw);
    if (v.ok) {
      p.fields = v.value;
      if (options.blockSampleData && looksLikeSampleStudent(v.value)) {
        addError(p, "name", "This looks like sample/dummy data and cannot be imported into production.");
      }
    } else for (const e of v.errors) addError(p, e.field, e.message);

    const roomNumber = (c.room_number ?? "").trim();
    if (!roomNumber) addError(p, "roomNumber", "Room number is required.");
    else if (!ROOM_NUMBER_PATTERN.test(roomNumber)) addError(p, "roomNumber", `"${roomNumber}" is not a valid room number.`);
    else {
      const room = roomByNumber.get(roomNumber);
      if (!room) addError(p, "roomNumber", `Room ${roomNumber} does not exist. Add the room first.`);
      else if (!room.isActive) addError(p, "roomNumber", `Room ${roomNumber} is inactive.`);
      else p.roomId = room.id;
    }

    if (v.ok && v.value.studentCode) {
      const existing = byCode.get(v.value.studentCode);
      if (existing) {
        p.intent = "update";
        p.studentId = existing.id;
      }
    } else if (v.ok && p.roomId) {
      const match = existingKeys.get(keyOf(v.value.name, p.roomId, v.value.parentWhatsapp));
      if (match) {
        addError(
          p,
          "name",
          `Looks like existing student "${match}" (same name, room and parent number). Add their student_code to update them, or remove this row.`,
        );
      }
    }
  }

  // ---- Pass 2: duplicates inside the file ----
  const codeRows = new Map<string, PlannedRow[]>();
  const keyRows = new Map<string, PlannedRow[]>();
  for (const p of planned) {
    if (!p.fields) continue;
    if (p.fields.studentCode) {
      codeRows.set(p.fields.studentCode, [...(codeRows.get(p.fields.studentCode) ?? []), p]);
    } else if (p.roomId) {
      const k = keyOf(p.fields.name, p.roomId, p.fields.parentWhatsapp);
      keyRows.set(k, [...(keyRows.get(k) ?? []), p]);
    }
  }
  for (const [code, group] of codeRows) {
    if (group.length > 1) {
      const nums = group.map((g) => g.rowNumber).join(", ");
      for (const g of group) addError(g, "studentCode", `student_code ${code} is used in rows ${nums}. Each student needs a unique code.`);
    }
  }
  for (const group of keyRows.values()) {
    if (group.length > 1) {
      const nums = group.map((g) => g.rowNumber).join(", ");
      for (const g of group) addError(g, "name", `Rows ${nums} look identical (same name, room and parent number).`);
    }
  }

  // ---- Pass 3: room capacity after applying every valid row ----
  const occupancy = new Map<string, number>();
  for (const s of snapshot.students) if (s.isActive) occupancy.set(s.roomId, (occupancy.get(s.roomId) ?? 0) + 1);
  const bump = (roomId: string, by: number) => occupancy.set(roomId, (occupancy.get(roomId) ?? 0) + by);
  const incoming = new Map<string, PlannedRow[]>();
  const addIncoming = (roomId: string, p: PlannedRow) => incoming.set(roomId, [...(incoming.get(roomId) ?? []), p]);

  for (const p of planned) {
    if (p.errors.length || !p.roomId) continue;
    if (p.intent === "create") {
      bump(p.roomId, 1);
      addIncoming(p.roomId, p);
    } else {
      const existing = p.studentId ? studentById.get(p.studentId) : undefined;
      if (existing?.isActive && existing.roomId !== p.roomId) {
        bump(existing.roomId, -1);
        bump(p.roomId, 1);
        addIncoming(p.roomId, p);
      }
    }
  }
  for (const [roomId, count] of occupancy) {
    const room = roomById.get(roomId);
    if (!room || count <= room.capacity) continue;
    for (const p of incoming.get(roomId) ?? []) {
      addError(p, "roomNumber", `Room ${room.roomNumber} holds ${room.capacity} student(s) but this import would put ${count} in it.`);
    }
  }

  // ---- Result ----
  const rows: PlannedRow[] = planned.map(({ intent, ...p }) => ({ ...p, action: p.errors.length ? "error" : intent }));
  const summary = {
    total: rows.length,
    create: rows.filter((r) => r.action === "create").length,
    update: rows.filter((r) => r.action === "update").length,
    errors: rows.filter((r) => r.action === "error").length,
  };
  return { fileErrors, rows, summary, canCommit: summary.errors === 0 && summary.total > 0 };
}
