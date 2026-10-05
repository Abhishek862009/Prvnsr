import { openBackupArchive, type OpenedBackup } from "./backup-archive";
import { applyRetention, countRows, RESTORE_INSERT_ORDER, type BackupData, type DroppedCounts, type Row, type TableName } from "./backup-format";

/** What the restore needs from storage. The real implementation uses Drizzle; tests use an in-memory fake. */
export interface RestoreTx {
  /** Serialises restores (e.g. a Postgres advisory lock). */
  lock(): Promise<void>;
  /** Deletes ALL data of the included tables. Excluded data (Warden account, login attempts) is never touched. */
  wipeIncluded(): Promise<void>;
  insert(table: TableName, rows: Row[]): Promise<void>;
  /** Ends every parent session: restored password hashes may differ from the ones those sessions were issued for. */
  invalidateParentSessions(): Promise<void>;
}

export interface RestoreStore {
  /** Saves an encrypted copy of the CURRENT data. Must succeed before anything is changed. */
  createSafetyBackup(): Promise<void>;
  /** All-or-nothing: if `fn` throws, every change made through `tx` is rolled back. */
  transaction<T>(fn: (tx: RestoreTx) => Promise<T>): Promise<T>;
}

export type RestoreResult = { restored: Record<TableName, number>; droppedExpired: DroppedCounts; exportedAt: string };

/** Read-only: decrypts and fully validates, reporting what a restore would do. Touches nothing. */
export function inspectBackup(zip: Buffer, password: string, now: Date) {
  const opened = openBackupArchive(zip, password);
  const { data, dropped } = applyRetention(opened.data, now);
  return { manifest: opened.manifest, willRestore: countRows(data), droppedExpired: dropped, data };
}

/**
 * Order is the whole safety story:
 *  1. open + validate the backup           (any problem -> rejected, database never touched)
 *  2. create a safety backup of live data  (failure -> abort, nothing changed)
 *  3. ONE transaction: lock, wipe included tables, insert in FK order, end parent sessions
 *     (any failure -> rollback, live data exactly as before)
 */
export async function restoreFromArchive(store: RestoreStore, zip: Buffer, password: string, now: Date): Promise<RestoreResult> {
  const opened: OpenedBackup = openBackupArchive(zip, password);
  const { data, dropped } = applyRetention(opened.data, now);

  await store.createSafetyBackup();

  await store.transaction(async (tx) => {
    await tx.lock();
    await tx.wipeIncluded();
    for (const table of RESTORE_INSERT_ORDER) await tx.insert(table, (data as BackupData)[table]);
    await tx.invalidateParentSessions();
  });

  return { restored: countRows(data), droppedExpired: dropped, exportedAt: opened.manifest.exported_at };
}
