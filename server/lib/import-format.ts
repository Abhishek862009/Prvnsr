import { toCsv } from "./csv";

/** CSV columns, in sample order. Maps CSV column -> field name used by validation. */
export const IMPORT_COLUMNS = [
  { column: "student_code", field: "studentCode", required: false },
  { column: "name", field: "name", required: true },
  { column: "room_number", field: "roomNumber", required: true },
  { column: "parent_name", field: "parentName", required: false },
  { column: "parent_email", field: "parentEmail", required: false },
  { column: "parent_whatsapp", field: "parentWhatsapp", required: true },
  { column: "secondary_name", field: "secondaryName", required: false },
  { column: "secondary_email", field: "secondaryEmail", required: false },
  { column: "secondary_whatsapp", field: "secondaryWhatsapp", required: false },
  { column: "student_phone", field: "studentPhone", required: false },
] as const;

export const FIELD_TO_COLUMN: Record<string, string> = Object.fromEntries(
  IMPORT_COLUMNS.map((c) => [c.field, c.column]),
);

export const IMPORT_LIMITS = { maxRows: 1000, maxBytes: 1_000_000 } as const;

/** Obviously fake example rows (example.com, placeholder numbers). Never real data. */
export function sampleImportCsv(): string {
  return toCsv([
    IMPORT_COLUMNS.map((c) => c.column),
    ["SAMPLE-001", "Sample Student One", "101", "Sample Parent", "parent.one@example.com", "98765 00001", "", "", "", ""],
    ["", "Sample Student Two", "101", "", "", "98765 00002", "Second Contact", "second@example.com", "98765 00003", "98765 00004"],
  ]);
}
