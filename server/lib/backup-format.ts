import { createHash } from "node:crypto";
import { retentionCutoffs, CLEANUP_TIMEZONE } from "./retention";

/**
 * WHAT A BACKUP CONTAINS (and what it never does). Everything here is plain data + pure functions,
 * so the rules are testable without a database.
 *
 * INCLUDED : rooms, students, parent accounts (with password hashes), parent-student links, settings,
 *            the retained 30 days of checking data, room daily states, acknowledgements, WhatsApp
 *            delivery logs, and enquiries still inside their 90-day window.
 * EXCLUDED : Warden account + password hash, Warden/parent sessions, login attempts, the recovery key
 *            (never in the database), enquiry IP hashes, safety backups, and every environment secret.
 */
export const BACKUP_SCHEMA_VERSION = 1;
export const BACKUP_APP = "varindavan-hostel";

type Kind = "uuid" | "text" | "bool" | "int" | "ts" | "date" | { enum: readonly string[] };
type Col = { kind: Kind; nullable?: true };
type Spec = Record<string, Col>;

export const TABLE_NAMES = [
  "rooms",
  "students",
  "parent_accounts",
  "parent_student_links",
  "app_settings",
  "daily_checks",
  "daily_room_states",
  "acknowledgements",
  "delivery_log",
  "enquiries",
] as const;
export type TableName = (typeof TABLE_NAMES)[number];
export type Row = Record<string, unknown>;
export type BackupData = Record<TableName, Row[]>;

const uuid: Col = { kind: "uuid" };
const text: Col = { kind: "text" };
const ts: Col = { kind: "ts" };
const nText: Col = { kind: "text", nullable: true };
const nTs: Col = { kind: "ts", nullable: true };

/** Column specs use the same property names as the Drizzle schema. Columns not listed are never exported. */
export const BACKUP_TABLES: Record<TableName, Spec> = {
  rooms: {
    id: uuid, roomNumber: text, floor: { kind: "int" }, capacity: { kind: "int" }, isActive: { kind: "bool" },
    publicAvailability: { kind: { enum: ["available", "full"] } }, createdAt: ts, updatedAt: ts,
  },
  students: {
    id: uuid, studentCode: nText, name: text, roomId: uuid, parentName: nText, parentEmail: nText, parentWhatsapp: nText,
    secondaryName: nText, secondaryEmail: nText, secondaryWhatsapp: nText, studentPhone: nText,
    isActive: { kind: "bool" }, deactivatedAt: nTs, createdAt: ts, updatedAt: ts,
  },
  parent_accounts: {
    id: uuid, mobileE164: text, passwordHash: text, mustChangePassword: { kind: "bool" },
    passwordChangedAt: nTs, lastLoginAt: nTs, createdAt: ts, updatedAt: ts,
  },
  parent_student_links: { parentId: uuid, studentId: uuid, createdAt: ts },
  app_settings: { key: text, value: text, updatedAt: ts },
  daily_checks: {
    id: uuid, checkDate: { kind: "date" }, studentId: uuid, roomNumberSnapshot: text,
    status: { kind: { enum: ["present", "absent", "other"] } }, stars: { kind: "int", nullable: true }, note: text,
    revision: { kind: "int" }, lastEditedAt: nTs, createdAt: ts, updatedAt: ts,
  },
  daily_room_states: {
    id: uuid, checkDate: { kind: "date" }, roomId: uuid, isVacant: { kind: "bool" },
    isManuallyComplete: { kind: "bool" }, commonNote: text, updatedAt: ts,
  },
  acknowledgements: { id: uuid, dailyCheckId: uuid, parentId: uuid, revision: { kind: "int" }, acknowledgedAt: ts },
  delivery_log: {
    id: uuid, dailyCheckId: uuid, channel: { kind: { enum: ["whatsapp", "email", "sms"] } },
    revision: { kind: "int" }, openedAt: ts,
  },
  enquiries: {
    id: uuid, name: text, phone: text, email: nText, preferredRoomType: nText,
    expectedJoiningDate: { kind: "date", nullable: true }, message: nText,
    status: { kind: { enum: ["new", "contacted", "closed"] } }, createdAt: ts,
  },
};

/** Parents' rows are restored in this order (parents before links, checks before acknowledgements...). */
export const RESTORE_INSERT_ORDER: readonly TableName[] = TABLE_NAMES;

/** Documented exclusions (also asserted by tests). */
export const EXCLUDED_FROM_BACKUP = [
  "warden_accounts",
  "warden_sessions",
  "parent_sessions",
  "login_attempts",
  "safety_backups",
  "enquiries.ipHash",
  "RECOVERY_KEY / environment secrets",
] as const;

// ---------------------------------------------------------------- serialise
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v);

/** Keeps ONLY the specified columns of each row, with Dates as ISO strings. */
export function serializeTables(raw: Partial<Record<TableName, Row[]>>): BackupData {
  const out = {} as BackupData;
  for (const t of TABLE_NAMES) {
    const cols = Object.keys(BACKUP_TABLES[t]);
    out[t] = (raw[t] ?? []).map((row) => Object.fromEntries(cols.map((c) => [c, iso(row[c] ?? null)])));
  }
  return out;
}

const TS_COLS = (t: TableName) => Object.entries(BACKUP_TABLES[t]).filter(([, s]) => s.kind === "ts").map(([c]) => c);

/** Inverse of serialize for the timestamp columns (ISO strings -> Date) so rows can be inserted. */
export function deserializeTables(data: BackupData): BackupData {
  const out = {} as BackupData;
  for (const t of TABLE_NAMES) {
    const tsCols = TS_COLS(t);
    out[t] = data[t].map((row) => {
      const r: Row = { ...row };
      for (const c of tsCols) if (typeof r[c] === "string") r[c] = new Date(r[c] as string);
      return r;
    });
  }
  return out;
}

// ---------------------------------------------------------------- retention
const ms = (v: unknown) => (v instanceof Date ? v.getTime() : Date.parse(String(v)));

export type DroppedCounts = { daily_checks: number; daily_room_states: number; acknowledgements: number; delivery_log: number; enquiries: number };

/**
 * Drops data older than the retention windows (works for both serialised and Date rows).
 * Used when taking a backup AND when restoring one, so an old backup never brings back expired data.
 */
export function applyRetention(data: BackupData, now: Date): { data: BackupData; dropped: DroppedCounts } {
  const c = retentionCutoffs(now);
  const checks = data.daily_checks.filter((r) => String(r.checkDate) >= c.checkingKeepFrom);
  const keep = new Set(checks.map((r) => r.id));
  const rooms = data.daily_room_states.filter((r) => String(r.checkDate) >= c.checkingKeepFrom);
  const acks = data.acknowledgements.filter((r) => keep.has(r.dailyCheckId) && ms(r.acknowledgedAt) >= c.checkingCutoffInstant.getTime());
  const logs = data.delivery_log.filter((r) => keep.has(r.dailyCheckId) && ms(r.openedAt) >= c.checkingCutoffInstant.getTime());
  const enq = data.enquiries.filter((r) => ms(r.createdAt) >= c.enquiryCutoffInstant.getTime());
  return {
    data: { ...data, daily_checks: checks, daily_room_states: rooms, acknowledgements: acks, delivery_log: logs, enquiries: enq },
    dropped: {
      daily_checks: data.daily_checks.length - checks.length,
      daily_room_states: data.daily_room_states.length - rooms.length,
      acknowledgements: data.acknowledgements.length - acks.length,
      delivery_log: data.delivery_log.length - logs.length,
      enquiries: data.enquiries.length - enq.length,
    },
  };
}

export const countRows = (data: BackupData): Record<TableName, number> =>
  Object.fromEntries(TABLE_NAMES.map((t) => [t, data[t].length])) as Record<TableName, number>;

/** What a backup takes from the live database: serialise (drops excluded columns) then apply retention. */
export function prepareBackupData(raw: Partial<Record<TableName, Row[]>>, now: Date): BackupData {
  return applyRetention(serializeTables(raw), now).data;
}

// ---------------------------------------------------------------- manifest + version
export type Manifest = {
  app: string;
  schema_version: number;
  exported_at: string;
  timezone: string;
  counts: Record<TableName, number>;
  data_sha256: string;
  retention: { checking_days: number; enquiry_days: number };
  excludes: readonly string[];
};

export const sha256Hex = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");

export function buildManifest(data: BackupData, dataJson: Buffer, now: Date): Manifest {
  return {
    app: BACKUP_APP,
    schema_version: BACKUP_SCHEMA_VERSION,
    exported_at: now.toISOString(),
    timezone: CLEANUP_TIMEZONE,
    counts: countRows(data),
    data_sha256: sha256Hex(dataJson),
    retention: { checking_days: 30, enquiry_days: 90 },
    excludes: EXCLUDED_FROM_BACKUP,
  };
}

export type VersionCheck = { ok: true } | { ok: false; reason: "invalid" | "newer" | "older" };

/** Only the exact current schema version can be restored. Newer = made by a newer app; older = needs a migration we do not have. */
export function checkSchemaVersion(v: unknown): VersionCheck {
  if (typeof v !== "number" || !Number.isInteger(v) || v < 1) return { ok: false, reason: "invalid" };
  if (v > BACKUP_SCHEMA_VERSION) return { ok: false, reason: "newer" };
  if (v < BACKUP_SCHEMA_VERSION) return { ok: false, reason: "older" };
  return { ok: true };
}

export function parseManifest(m: unknown): { ok: true; manifest: Manifest } | { ok: false; error: string } {
  if (typeof m !== "object" || m === null) return { ok: false, error: "Manifest is missing." };
  const o = m as Record<string, unknown>;
  if (o.app !== BACKUP_APP) return { ok: false, error: "This is not a Varindavan hostel backup." };
  if (typeof o.exported_at !== "string" || Number.isNaN(Date.parse(o.exported_at))) return { ok: false, error: "Manifest export time is invalid." };
  if (typeof o.timezone !== "string") return { ok: false, error: "Manifest timezone is missing." };
  if (typeof o.data_sha256 !== "string" || !/^[0-9a-f]{64}$/.test(o.data_sha256)) return { ok: false, error: "Manifest checksum is invalid." };
  const counts = o.counts as Record<string, unknown> | undefined;
  if (!counts || TABLE_NAMES.some((t) => !Number.isInteger(counts[t]))) return { ok: false, error: "Manifest row counts are invalid." };
  return { ok: true, manifest: o as unknown as Manifest };
}

// ---------------------------------------------------------------- validation
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const E164 = /^\+[1-9]\d{7,14}$/;
const MAX_TEXT = 20000;

function cellError(kind: Kind, v: unknown): string | null {
  if (typeof kind === "object") return typeof v === "string" && kind.enum.includes(v) ? null : `must be one of ${kind.enum.join("/")}`;
  switch (kind) {
    case "uuid": return typeof v === "string" && UUID.test(v) ? null : "must be a UUID";
    case "text": return typeof v === "string" && v.length <= MAX_TEXT ? null : "must be text";
    case "bool": return typeof v === "boolean" ? null : "must be true/false";
    case "int": return typeof v === "number" && Number.isInteger(v) ? null : "must be a whole number";
    case "ts": return typeof v === "string" && TS.test(v) && !Number.isNaN(Date.parse(v)) ? null : "must be a timestamp";
    case "date": {
      if (typeof v !== "string" || !DATE.test(v)) return "must be a date";
      return new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v ? null : "must be a real date";
    }
  }
}

export type ValidationResult = { ok: true; data: BackupData } | { ok: false; errors: string[] };

/**
 * Full validation BEFORE the database is touched: shapes, types, enums, uniqueness, foreign keys and the
 * business constraints the schema enforces (stars rule, "Other" needs a note, capacity >= 1, ...).
 */
export function validateBackupData(input: unknown): ValidationResult {
  const errors: string[] = [];
  const err = (m: string) => { if (errors.length < 25) errors.push(m); };

  if (typeof input !== "object" || input === null) return { ok: false, errors: ["Backup data is missing."] };
  const obj = input as Record<string, unknown>;
  for (const k of Object.keys(obj)) if (!(TABLE_NAMES as readonly string[]).includes(k)) err(`Unexpected table "${k}".`);
  for (const t of TABLE_NAMES) if (!Array.isArray(obj[t])) err(`Table "${t}" is missing.`);
  if (errors.length) return { ok: false, errors };

  const data = obj as unknown as BackupData;

  // ---- per-cell checks
  for (const t of TABLE_NAMES) {
    const spec = BACKUP_TABLES[t];
    data[t].forEach((row, i) => {
      if (typeof row !== "object" || row === null || Array.isArray(row)) return err(`${t}[${i}] is not an object.`);
      for (const k of Object.keys(row)) if (!(k in spec)) err(`${t}[${i}] has unexpected field "${k}".`);
      for (const [col, c] of Object.entries(spec)) {
        const v = row[col];
        if (v === null || v === undefined) {
          if (!c.nullable) err(`${t}[${i}].${col} is required.`);
        } else {
          const e = cellError(c.kind, v);
          if (e) err(`${t}[${i}].${col} ${e}.`);
        }
      }
    });
  }
  if (errors.length) return { ok: false, errors };

  // ---- uniqueness + foreign keys
  const ids = (t: TableName) => new Set(data[t].map((r) => r.id as string));
  const unique = (t: TableName, label: string, key: (r: Row) => string | null) => {
    const seen = new Set<string>();
    for (const r of data[t]) {
      const k = key(r);
      if (k === null) continue;
      if (seen.has(k)) err(`${t}: duplicate ${label} "${k}".`);
      seen.add(k);
    }
  };
  for (const t of TABLE_NAMES) if (t !== "parent_student_links" && t !== "app_settings") unique(t, "id", (r) => r.id as string);
  unique("rooms", "room number", (r) => r.roomNumber as string);
  unique("students", "student code", (r) => (r.studentCode as string | null) ?? null);
  unique("parent_accounts", "mobile number", (r) => r.mobileE164 as string);
  unique("parent_student_links", "link", (r) => `${r.parentId}|${r.studentId}`);
  unique("app_settings", "key", (r) => r.key as string);
  unique("daily_checks", "student/date", (r) => `${r.checkDate}|${r.studentId}`);
  unique("daily_room_states", "room/date", (r) => `${r.checkDate}|${r.roomId}`);
  unique("acknowledgements", "check/parent", (r) => `${r.dailyCheckId}|${r.parentId}`);

  const roomIds = ids("rooms"), studentIds = ids("students"), parentIds = ids("parent_accounts"), checkIds = ids("daily_checks");
  const checkRevision = new Map(data.daily_checks.map((r) => [r.id as string, r.revision as number]));
  const fk = (t: TableName, col: string, target: Set<string>, label: string) => {
    data[t].forEach((r, i) => { if (!target.has(r[col] as string)) err(`${t}[${i}].${col} points to a missing ${label}.`); });
  };
  fk("students", "roomId", roomIds, "room");
  fk("parent_student_links", "parentId", parentIds, "parent account");
  fk("parent_student_links", "studentId", studentIds, "student");
  fk("daily_checks", "studentId", studentIds, "student");
  fk("daily_room_states", "roomId", roomIds, "room");
  fk("acknowledgements", "dailyCheckId", checkIds, "daily check");
  fk("acknowledgements", "parentId", parentIds, "parent account");
  fk("delivery_log", "dailyCheckId", checkIds, "daily check");

  // ---- business constraints (mirror the database CHECK constraints)
  data.rooms.forEach((r, i) => { if ((r.capacity as number) < 1) err(`rooms[${i}].capacity must be at least 1.`); });
  data.parent_accounts.forEach((r, i) => { if (!E164.test(r.mobileE164 as string)) err(`parent_accounts[${i}].mobileE164 must be an E.164 number.`); });
  data.daily_checks.forEach((r, i) => {
    const present = r.status === "present";
    const stars = r.stars as number | null;
    if (present && !(stars !== null && stars >= 1 && stars <= 5)) err(`daily_checks[${i}]: Present needs 1-5 stars.`);
    if (!present && stars !== null) err(`daily_checks[${i}]: only Present may have stars.`);
    if (r.status === "other" && String(r.note).trim() === "") err(`daily_checks[${i}]: status Other needs a note.`);
    if ((r.revision as number) < 1) err(`daily_checks[${i}].revision must be at least 1.`);
  });
  data.daily_room_states.forEach((r, i) => { if (r.isVacant && r.isManuallyComplete) err(`daily_room_states[${i}] cannot be both vacant and complete.`); });
  for (const t of ["acknowledgements", "delivery_log"] as const) {
    data[t].forEach((r, i) => {
      const max = checkRevision.get(r.dailyCheckId as string);
      if ((r.revision as number) < 1 || (max !== undefined && (r.revision as number) > max)) err(`${t}[${i}].revision is not valid for its report.`);
    });
  }

  return errors.length ? { ok: false, errors } : { ok: true, data };
}

/** Password rule for backups: the ZIP format fixes the key-stretching at 1000 rounds, so require length. */
export const BACKUP_PASSWORD_MIN = 12;
export const BACKUP_PASSWORD_MAX = 128;

export function checkBackupPassword(password: string, confirm?: string): string | null {
  if (password.length < BACKUP_PASSWORD_MIN) return `Backup password must be at least ${BACKUP_PASSWORD_MIN} characters.`;
  if (password.length > BACKUP_PASSWORD_MAX) return `Backup password must be at most ${BACKUP_PASSWORD_MAX} characters.`;
  if (confirm !== undefined && confirm !== password) return "The two backup passwords do not match.";
  return null;
}
