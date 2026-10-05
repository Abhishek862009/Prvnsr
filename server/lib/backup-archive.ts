import { createEncryptedZip, readEncryptedZip, ZipCryptError } from "./backup-zip";
import {
  buildManifest, checkSchemaVersion, deserializeTables, parseManifest, prepareBackupData, sha256Hex,
  TABLE_NAMES, validateBackupData, type BackupData, type Manifest, type Row, type TableName,
} from "./backup-format";

export type BackupErrorCode = "not_a_backup" | "wrong_password" | "corrupted" | "incompatible_version" | "invalid_data";

/** Every way a backup can be rejected. Raised BEFORE any database change. */
export class BackupError extends Error {
  readonly code: BackupErrorCode;
  readonly details: string[];
  constructor(code: BackupErrorCode, message: string, details: string[] = []) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

export const MANIFEST_NAME = "manifest.json";
export const DATA_NAME = "data.json";

/** Builds the encrypted ZIP from raw table rows (retention applied, excluded columns dropped). */
export function createBackupArchive(raw: Partial<Record<TableName, Row[]>>, password: string, now: Date): Buffer {
  const data = prepareBackupData(raw, now);
  const dataJson = Buffer.from(JSON.stringify(data), "utf8");
  const manifest = buildManifest(data, dataJson, now);
  return createEncryptedZip(
    [
      { name: MANIFEST_NAME, data: Buffer.from(JSON.stringify(manifest, null, 2), "utf8") },
      { name: DATA_NAME, data: dataJson },
    ],
    password,
    now,
  );
}

export type OpenedBackup = { manifest: Manifest; data: BackupData };

const parseJson = (b: Buffer, what: string): unknown => {
  try {
    return JSON.parse(b.toString("utf8"));
  } catch {
    throw new BackupError("corrupted", `${what} is damaged.`);
  }
};

/** Decrypt + check version + checksum + counts + full data validation. Returns Date-typed rows. */
export function openBackupArchive(zip: Buffer, password: string): OpenedBackup {
  let entries;
  try {
    entries = readEncryptedZip(zip, password);
  } catch (e) {
    if (e instanceof ZipCryptError) {
      const code = e.code === "wrong_password" ? "wrong_password" : e.code === "corrupted" ? "corrupted" : "not_a_backup";
      throw new BackupError(code, e.message);
    }
    throw e;
  }

  const byName = new Map(entries.map((e) => [e.name, e.data]));
  const manifestBuf = byName.get(MANIFEST_NAME);
  const dataBuf = byName.get(DATA_NAME);
  if (!manifestBuf || !dataBuf || entries.length !== 2) throw new BackupError("not_a_backup", "This is not a Varindavan hostel backup.");

  const rawManifest = parseJson(manifestBuf, "The backup manifest");
  const version = checkSchemaVersion((rawManifest as { schema_version?: unknown } | null)?.schema_version);
  if (!version.ok) {
    const msg =
      version.reason === "newer"
        ? "This backup was made by a newer version of the application and cannot be restored here."
        : version.reason === "older"
          ? "This backup uses an older, unsupported data format."
          : "The backup has no valid schema version.";
    throw new BackupError("incompatible_version", msg);
  }
  const m = parseManifest(rawManifest);
  if (!m.ok) throw new BackupError("not_a_backup", m.error);

  if (sha256Hex(dataBuf) !== m.manifest.data_sha256) throw new BackupError("corrupted", "The backup data does not match its checksum.");

  const validated = validateBackupData(parseJson(dataBuf, "The backup data"));
  if (!validated.ok) throw new BackupError("invalid_data", "The backup data is not valid.", validated.errors);

  for (const t of TABLE_NAMES) {
    if (validated.data[t].length !== m.manifest.counts[t]) {
      throw new BackupError("invalid_data", `Row count for "${t}" does not match the manifest.`);
    }
  }
  return { manifest: m.manifest, data: deserializeTables(validated.data) };
}
