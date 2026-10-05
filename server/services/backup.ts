import { getDb } from "@/server/db/client";
import { BackupError, createBackupArchive } from "@/server/lib/backup-archive";
import { checkBackupPassword } from "@/server/lib/backup-format";
import { dateInZone } from "@/server/lib/dates";
import { DomainError } from "@/server/lib/errors";
import { inspectBackup, restoreFromArchive, type RestoreStore } from "@/server/lib/restore-flow";
import { CLEANUP_TIMEZONE } from "@/server/lib/retention";
import * as backupRepo from "@/server/repos/backup";

export const RESTORE_CONFIRM_TEXT = "RESTORE";

/** The backup password is only ever a function argument: it is never stored, logged or returned. */
const toDomain = (err: unknown): never => {
  if (err instanceof BackupError) throw new DomainError("validation", err.message, { code: err.code, errors: err.details });
  throw err;
};

/** One consistent snapshot of the data (repeatable read, read-only). */
const readSnapshot = () =>
  getDb().transaction((tx) => backupRepo.readAllForBackup(tx), { isolationLevel: "repeatable read", accessMode: "read only" });

function stamp(now: Date) {
  const hhmm = new Intl.DateTimeFormat("en-GB", { timeZone: CLEANUP_TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false }).format(now).replace(":", "");
  return `${dateInZone(now, CLEANUP_TIMEZONE)}-${hhmm}`;
}

export async function createBackupFile(password: string, confirmPassword: string, now: Date = new Date()) {
  const problem = checkBackupPassword(password, confirmPassword);
  if (problem) throw new DomainError("validation", problem);
  const raw = await readSnapshot();
  return { buffer: createBackupArchive(raw, password, now), filename: `varindavan-backup-${stamp(now)}.zip` };
}

/** Dry run: decrypt + full validation + what would be restored. Writes nothing. */
export function previewRestore(zip: Buffer, password: string, now: Date = new Date()) {
  try {
    const r = inspectBackup(zip, password, now);
    return {
      schemaVersion: r.manifest.schema_version,
      exportedAt: r.manifest.exported_at,
      timezone: r.manifest.timezone,
      willRestore: r.willRestore,
      droppedExpired: r.droppedExpired,
    };
  } catch (err) {
    return toDomain(err);
  }
}

/** Real store: safety backup = encrypted copy of live data (same password) saved before anything changes. */
function realStore(password: string, now: Date, onSafety: (s: { id: string; createdAt: Date; sizeBytes: number }) => void): RestoreStore {
  return {
    async createSafetyBackup() {
      const live = await readSnapshot();
      const zip = createBackupArchive(live, password, now);
      onSafety(await backupRepo.saveSafetyBackup({ sizeBytes: zip.length, dataBase64: zip.toString("base64") }));
    },
    transaction: (fn) =>
      getDb().transaction((tx) =>
        fn({
          lock: () => backupRepo.lockForRestore(tx),
          wipeIncluded: () => backupRepo.wipeIncludedTables(tx),
          insert: (table, rows) => backupRepo.insertBackupRows(tx, table, rows),
          invalidateParentSessions: () => backupRepo.deleteAllParentSessions(tx),
        }),
      ),
  };
}

export async function restoreBackup(zip: Buffer, password: string, confirmText: string, now: Date = new Date()) {
  if (confirmText !== RESTORE_CONFIRM_TEXT) throw new DomainError("validation", `Type ${RESTORE_CONFIRM_TEXT} to confirm the restore.`);
  const safety: { value: { id: string; createdAt: Date; sizeBytes: number } | null } = { value: null };
  try {
    const result = await restoreFromArchive(realStore(password, now, (s) => { safety.value = s; }), zip, password, now);
    return { ...result, safetyBackup: safety.value };
  } catch (err) {
    return toDomain(err);
  }
}

/** The encrypted safety copy taken before the last restore (same password as that restore). */
export async function getSafetyBackupFile() {
  const row = await backupRepo.getLatestSafetyBackup();
  if (!row) return null;
  return { buffer: Buffer.from(row.dataBase64, "base64"), filename: `varindavan-safety-backup-${stamp(row.createdAt)}.zip` };
}
