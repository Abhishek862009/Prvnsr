import { getTableColumns, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { getDb, type DbOrTx, type Tx } from "@/server/db/client";
import {
  acknowledgements, dailyChecks, dailyRoomStates, deliveryLog, enquiries, parentAccounts, parentSessions,
  parentStudentLinks, appSettings, rooms, safetyBackups, students,
} from "@/server/db/schema";
import type { Row, TableName } from "@/server/lib/backup-format";

/**
 * Data access for backup/restore. This file deliberately never imports the Warden account,
 * Warden sessions or login-attempt tables: they cannot be exported, wiped or restored from here.
 */
const TABLES: Record<TableName, PgTable> = {
  rooms, students, parent_accounts: parentAccounts, parent_student_links: parentStudentLinks, app_settings: appSettings,
  daily_checks: dailyChecks, daily_room_states: dailyRoomStates, acknowledgements, delivery_log: deliveryLog, enquiries,
};

/** Reads every included table. (Enquiry IP hashes are not even selected.) */
export async function readAllForBackup(dbx: DbOrTx): Promise<Record<TableName, Row[]>> {
  // Enquiry IP hashes are rate-limit data, not application data: never selected, never exported.
  const enquiryColumns = getTableColumns(enquiries) as Record<string, unknown>;
  delete enquiryColumns.ipHash;
  const [r, s, pa, pl, st, dc, rs, ak, dl, en] = await Promise.all([
    dbx.select().from(rooms),
    dbx.select().from(students),
    dbx.select().from(parentAccounts),
    dbx.select().from(parentStudentLinks),
    dbx.select().from(appSettings),
    dbx.select().from(dailyChecks),
    dbx.select().from(dailyRoomStates),
    dbx.select().from(acknowledgements),
    dbx.select().from(deliveryLog),
    dbx.select(enquiryColumns as never).from(enquiries),
  ]);
  return {
    rooms: r, students: s, parent_accounts: pa, parent_student_links: pl, app_settings: st,
    daily_checks: dc, daily_room_states: rs, acknowledgements: ak, delivery_log: dl, enquiries: en,
  } as Record<TableName, Row[]>;
}

// ---------------- restore primitives (all take the transaction) ----------------
export async function lockForRestore(tx: Tx) {
  await tx.execute(sql`select pg_advisory_xact_lock(727001)`);
}

/** Children before parents so foreign keys never block. Parent sessions go first (they reference parent accounts). */
export async function wipeIncludedTables(tx: Tx) {
  await tx.delete(deliveryLog);
  await tx.delete(acknowledgements);
  await tx.delete(dailyChecks);
  await tx.delete(dailyRoomStates);
  await tx.delete(parentStudentLinks);
  await tx.delete(parentSessions);
  await tx.delete(parentAccounts);
  await tx.delete(students);
  await tx.delete(rooms);
  await tx.delete(enquiries);
  await tx.delete(appSettings);
}

export async function insertBackupRows(tx: Tx, table: TableName, rows: Row[]) {
  const target = TABLES[table];
  for (let i = 0; i < rows.length; i += 500) {
    // Rows were validated against the column specs; enquiries.ip_hash is simply left empty.
    await tx.insert(target).values(rows.slice(i, i + 500) as never);
  }
}

export async function deleteAllParentSessions(tx: Tx) {
  await tx.delete(parentSessions);
}

// ---------------- safety backups ----------------
export async function saveSafetyBackup(args: { sizeBytes: number; dataBase64: string }, dbx: DbOrTx = getDb()) {
  const [row] = await dbx.insert(safetyBackups).values(args).returning({ id: safetyBackups.id, createdAt: safetyBackups.createdAt, sizeBytes: safetyBackups.sizeBytes });
  if (!row) throw new Error("Safety backup was not saved.");
  // Keep only the newest one.
  await dbx.delete(safetyBackups).where(sql`${safetyBackups.id} <> ${row.id}`);
  return row;
}

export async function getLatestSafetyBackup(dbx: DbOrTx = getDb()) {
  const [row] = await dbx.select().from(safetyBackups).orderBy(sql`${safetyBackups.createdAt} desc`).limit(1);
  return row ?? null;
}
