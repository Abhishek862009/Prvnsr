import { pbkdf2Sync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { BackupError, createBackupArchive, DATA_NAME, MANIFEST_NAME, openBackupArchive } from "@/server/lib/backup-archive";
import {
  BACKUP_SCHEMA_VERSION, buildManifest, checkBackupPassword, checkSchemaVersion, EXCLUDED_FROM_BACKUP, prepareBackupData,
  TABLE_NAMES, validateBackupData, type BackupData, type Row, type TableName,
} from "@/server/lib/backup-format";
import { createEncryptedZip, readEncryptedZip, ZipCryptError } from "@/server/lib/backup-zip";
import { inspectBackup, restoreFromArchive, type RestoreStore } from "@/server/lib/restore-flow";

const u = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const NOW = new Date("2026-10-01T10:00:00.000Z"); // 15:30 IST, 1 Oct 2026
const T = new Date("2026-10-01T09:00:00.000Z");
const PW = "correct horse battery";

function rawData(): Record<TableName, Row[]> {
  const base = { createdAt: T, updatedAt: T };
  return {
    rooms: [{ id: u(1), roomNumber: "101", floor: 1, capacity: 2, isActive: true, publicAvailability: "available", ...base }],
    students: [{ id: u(10), studentCode: "DUMMY-001", name: "Dummy One", roomId: u(1), parentName: null, parentEmail: "p@example.com", parentWhatsapp: "+919000000101", secondaryName: null, secondaryEmail: null, secondaryWhatsapp: null, studentPhone: null, isActive: true, deactivatedAt: null, ...base }],
    parent_accounts: [{ id: u(20), mobileE164: "+919000000101", passwordHash: "$argon2id$fake-parent-hash", mustChangePassword: false, passwordChangedAt: null, lastLoginAt: null, ...base }],
    parent_student_links: [{ parentId: u(20), studentId: u(10), createdAt: T }],
    app_settings: [{ key: "public_call_number", value: "+919000000001", updatedAt: T }],
    daily_checks: [
      { id: u(30), checkDate: "2026-10-01", studentId: u(10), roomNumberSnapshot: "101", status: "present", stars: 4, note: "ok", revision: 2, lastEditedAt: T, ...base },
      { id: u(31), checkDate: "2026-08-01", studentId: u(10), roomNumberSnapshot: "101", status: "absent", stars: null, note: "", revision: 1, lastEditedAt: null, ...base },
    ],
    daily_room_states: [
      { id: u(40), checkDate: "2026-10-01", roomId: u(1), isVacant: false, isManuallyComplete: false, commonNote: "tidy", updatedAt: T },
      { id: u(41), checkDate: "2026-08-01", roomId: u(1), isVacant: false, isManuallyComplete: false, commonNote: "", updatedAt: T },
    ],
    acknowledgements: [
      { id: u(50), dailyCheckId: u(30), parentId: u(20), revision: 1, acknowledgedAt: new Date("2026-10-01T09:30:00Z") },
      { id: u(51), dailyCheckId: u(31), parentId: u(20), revision: 1, acknowledgedAt: new Date("2026-08-01T09:30:00Z") },
    ],
    delivery_log: [
      { id: u(60), dailyCheckId: u(30), channel: "whatsapp", revision: 1, openedAt: new Date("2026-10-01T09:40:00Z") },
      { id: u(61), dailyCheckId: u(31), channel: "whatsapp", revision: 1, openedAt: new Date("2026-08-01T09:40:00Z") },
    ],
    enquiries: [
      { id: u(70), name: "Recent Visitor", phone: "+919000000011", email: null, preferredRoomType: "double", expectedJoiningDate: "2026-11-01", message: "hi", status: "new", ipHash: "SECRET-IP-HASH", createdAt: new Date("2026-09-20T10:00:00Z") },
      { id: u(71), name: "Old Visitor", phone: "+919000000012", email: null, preferredRoomType: "single", expectedJoiningDate: "2026-06-01", message: "old", status: "closed", ipHash: "SECRET-IP-HASH", createdAt: new Date("2026-05-01T10:00:00Z") },
    ],
  };
}

const errCode = (fn: () => unknown): string => {
  try {
    fn();
    return "none";
  } catch (e) {
    return e instanceof BackupError ? e.code : `other:${String(e)}`;
  }
};

/** Builds a backup archive from (possibly tampered) serialised data, with a correct manifest unless overridden. */
function forge(mutate?: (d: BackupData) => void, manifestOver?: (m: Record<string, unknown>) => void, dataJsonOverride?: string): Buffer {
  const data = prepareBackupData(rawData(), NOW);
  mutate?.(data);
  const dataJson = Buffer.from(dataJsonOverride ?? JSON.stringify(data), "utf8");
  const manifest = { ...buildManifest(data, Buffer.from(JSON.stringify(data)), NOW) } as Record<string, unknown>;
  if (!dataJsonOverride) manifest.data_sha256 = buildManifest(data, dataJson, NOW).data_sha256;
  manifestOver?.(manifest);
  return createEncryptedZip([{ name: MANIFEST_NAME, data: Buffer.from(JSON.stringify(manifest)) }, { name: DATA_NAME, data: dataJson }], PW, NOW);
}

describe("backup include / exclude rules", () => {
  it("includes exactly the listed tables and applies retention", () => {
    const d = prepareBackupData(rawData(), NOW);
    expect(Object.keys(d).sort()).toEqual([...TABLE_NAMES].sort());
    expect(d.rooms).toHaveLength(1);
    expect(d.students).toHaveLength(1);
    expect(d.parent_accounts).toHaveLength(1);
    expect(d.parent_student_links).toHaveLength(1);
    expect(d.app_settings).toHaveLength(1);
    expect(d.daily_checks).toHaveLength(1); // the 1 Aug check is older than 30 days
    expect(d.daily_room_states).toHaveLength(1);
    expect(d.acknowledgements).toHaveLength(1);
    expect(d.delivery_log).toHaveLength(1);
    expect(d.enquiries).toHaveLength(1); // the May enquiry is older than 90 days
  });
  it("never exports Warden data, sessions, login attempts, IP hashes or secrets", () => {
    const polluted = { ...rawData(), warden_accounts: [{ loginId: "warden", passwordHash: "WARDEN-HASH" }], warden_sessions: [{ tokenHash: "SESSION-HASH" }], login_attempts: [{ identifier: "x" }], parent_sessions: [{ tokenHash: "PSESSION" }] } as unknown as Record<TableName, Row[]>;
    const json = JSON.stringify(prepareBackupData(polluted, NOW));
    for (const secret of ["WARDEN-HASH", "SESSION-HASH", "PSESSION", "SECRET-IP-HASH", "login_attempts", "warden"]) expect(json.includes(secret)).toBe(false);
    for (const x of ["warden_accounts", "warden_sessions", "login_attempts", "parent_sessions", "enquiries.ipHash"]) expect(EXCLUDED_FROM_BACKUP.some((e) => e.includes(x))).toBe(true);
  });
  it("keeps parent password hashes (so parent passwords survive a restore)", () => {
    expect(JSON.stringify(prepareBackupData(rawData(), NOW)).includes("$argon2id$fake-parent-hash")).toBe(true);
  });
  it("manifest carries schema_version, export timestamp and timezone", () => {
    const m = openBackupArchive(createBackupArchive(rawData(), PW, NOW), PW).manifest;
    expect(m.schema_version).toBe(BACKUP_SCHEMA_VERSION);
    expect(m.exported_at).toBe(NOW.toISOString());
    expect(m.timezone).toBe("Asia/Kolkata");
    expect(m.counts.daily_checks).toBe(1);
  });
});

describe("encryption", () => {
  it("round-trips and returns timestamps as Date objects", () => {
    const o = openBackupArchive(createBackupArchive(rawData(), PW, NOW), PW);
    expect(o.data.rooms).toHaveLength(1);
    expect((o.data.rooms[0] as Row).createdAt instanceof Date).toBe(true);
    expect((o.data.students[0] as Row).name).toBe("Dummy One");
  });
  it("is a ZIP with AES (method 99) and no readable plaintext", () => {
    const z = createBackupArchive(rawData(), PW, NOW);
    expect(z.subarray(0, 4).toString("hex")).toBe("504b0304");
    expect(z.readUInt16LE(8)).toBe(99);
    const text = z.toString("latin1");
    for (const leak of ["Dummy One", "p@example.com", "9000000101", "schema_version", "Asia/Kolkata"]) expect(text.includes(leak)).toBe(false);
  });
  it("uses a fresh random salt each time", () => {
    expect(createBackupArchive(rawData(), PW, NOW).equals(createBackupArchive(rawData(), PW, NOW))).toBe(false);
  });
  it("rejects a wrong or empty password", () => {
    const z = createBackupArchive(rawData(), PW, NOW);
    expect(errCode(() => openBackupArchive(z, "wrong password here"))).toBe("wrong_password");
    expect(errCode(() => openBackupArchive(z, ""))).toBe("wrong_password");
    expect(errCode(() => openBackupArchive(z, PW + " "))).toBe("wrong_password");
  });
  it("rejects corrupted, truncated and non-backup files", () => {
    const z = createBackupArchive(rawData(), PW, NOW);
    const flipped = Buffer.from(z);
    flipped[77] = (flipped[77] as number) ^ 0xff; // inside the first entry's ciphertext
    expect(errCode(() => openBackupArchive(flipped, PW))).toBe("corrupted");
    expect(["not_a_backup", "corrupted"].includes(errCode(() => openBackupArchive(z.subarray(0, z.length - 30), PW)))).toBe(true);
    expect(errCode(() => openBackupArchive(Buffer.from("this is just text, not a zip file at all"), PW))).toBe("not_a_backup");
    expect(errCode(() => openBackupArchive(Buffer.alloc(0), PW))).toBe("not_a_backup");
    const noise = Buffer.alloc(500);
    for (let i = 0; i < noise.length; i++) noise[i] = (i * 31 + 7) % 251;
    expect(errCode(() => openBackupArchive(noise, PW))).toBe("not_a_backup");
  });
  it("the raw zip layer detects a tampered authentication code", () => {
    const z = createEncryptedZip([{ name: "a.txt", data: Buffer.from("hello world") }], PW, NOW);
    expect(readEncryptedZip(z, PW)[0]?.data.toString()).toBe("hello world");
    const bad = Buffer.from(z);
    const macPos = 30 + 5 + 11 + 16 + 2 + 5; // somewhere in the payload
    bad[macPos] = (bad[macPos] as number) ^ 1;
    expect(() => readEncryptedZip(bad, PW)).toThrow();
  });
  it("a backup with extra or missing entries is not accepted", () => {
    const one = createEncryptedZip([{ name: MANIFEST_NAME, data: Buffer.from("{}") }], PW, NOW);
    expect(errCode(() => openBackupArchive(one, PW))).toBe("not_a_backup");
  });
});

describe("wrong password never decrypts anything", () => {
  const secretText = "TOP-SECRET-STUDENT-NAME-ASHOK";
  const zip = () => createEncryptedZip([{ name: "data.json", data: Buffer.from(JSON.stringify({ name: secretText })) }], PW, NOW);
  const attempt = (pw: string) => {
    try {
      return { data: readEncryptedZip(zip(), pw), error: null as ZipCryptError | null };
    } catch (e) {
      return { data: null, error: e as ZipCryptError };
    }
  };

  it("the right password returns the plaintext; wrong ones return NO data and a wrong_password error", () => {
    const good = attempt(PW);
    expect(good.data?.[0]?.data.toString().includes(secretText)).toBe(true);
    for (const wrong of ["wrong", PW.toUpperCase(), PW + "!", ` ${PW}`, PW.slice(0, -1), "correct horse battery  ", "", "p\u00e4ssword-correct-horse"]) {
      const r = attempt(wrong);
      expect(r.data).toBeNull();
      expect(r.error instanceof ZipCryptError).toBe(true);
      expect(r.error?.code).toBe("wrong_password");
      expect(String(r.error?.message).includes(secretText)).toBe(false);
    }
  });
  it("even if the 2-byte password check were fooled (1 in 65,536), the HMAC still refuses to release data", () => {
    const z = Buffer.from(zip());
    const wrong = "a-different-but-long-password";
    // Layout of the first entry: 30-byte header + name(9) + extra(11), then salt(16) + verifier(2).
    const dataStart = 30 + "data.json".length + 11;
    const salt = z.subarray(dataStart, dataStart + 16);
    const forgedVerifier = pbkdf2Sync(Buffer.from(wrong, "utf8"), salt, 1000, 66, "sha1").subarray(64, 66);
    forgedVerifier.copy(z, dataStart + 16); // make the wrong password "pass" the quick check
    let result: unknown = "no error";
    try {
      result = readEncryptedZip(z, wrong);
    } catch (e) {
      result = (e as ZipCryptError).code;
    }
    expect(result).toBe("corrupted"); // rejected by the authentication code, no plaintext
    // ...and the correct password now fails too, because the file was tampered with:
    expect(() => readEncryptedZip(z, PW)).toThrow();
  });
  it("through the backup API the same wrong password is reported as wrong_password and leaks nothing", () => {
    const z = createBackupArchive(rawData(), PW, NOW);
    try {
      openBackupArchive(z, "totally wrong password");
      expect("should have thrown").toBe("did not");
    } catch (e) {
      expect(e instanceof BackupError).toBe(true);
      const err = e as BackupError;
      expect(err.code).toBe("wrong_password");
      expect(JSON.stringify([err.message, err.details]).includes("Dummy One")).toBe(false);
    }
  });
});

describe("schema version validation", () => {
  it("accepts only the current version", () => {
    expect(checkSchemaVersion(BACKUP_SCHEMA_VERSION).ok).toBe(true);
    expect(checkSchemaVersion(BACKUP_SCHEMA_VERSION + 1)).toEqual({ ok: false, reason: "newer" });
    expect(checkSchemaVersion(0)).toEqual({ ok: false, reason: "invalid" });
    expect(checkSchemaVersion("1")).toEqual({ ok: false, reason: "invalid" });
    expect(checkSchemaVersion(undefined)).toEqual({ ok: false, reason: "invalid" });
  });
  it("an archive from a newer app is rejected as incompatible", () => {
    expect(errCode(() => openBackupArchive(forge(undefined, (m) => { m.schema_version = 2; }), PW))).toBe("incompatible_version");
    expect(errCode(() => openBackupArchive(forge(undefined, (m) => { delete m.schema_version; }), PW))).toBe("incompatible_version");
  });
});

describe("restore validation (before the database is touched)", () => {
  const ok = () => prepareBackupData(rawData(), NOW);
  const errs = (mutate: (d: BackupData) => void) => {
    const d = ok();
    mutate(d);
    const r = validateBackupData(JSON.parse(JSON.stringify(d)));
    return r.ok ? [] : r.errors.join(" | ");
  };
  it("accepts a good backup", () => expect(validateBackupData(JSON.parse(JSON.stringify(ok()))).ok).toBe(true));
  it("rejects dangling foreign keys", () => {
    expect(errs((d) => { (d.students[0] as Row).roomId = u(999); })).toContain("missing room");
    expect(errs((d) => { (d.parent_student_links[0] as Row).studentId = u(999); })).toContain("missing student");
    expect(errs((d) => { (d.acknowledgements[0] as Row).parentId = u(999); })).toContain("missing parent");
  });
  it("rejects duplicates", () => {
    expect(errs((d) => { d.rooms.push({ ...(d.rooms[0] as Row), id: u(2) }); })).toContain("duplicate room number");
    expect(errs((d) => { d.parent_student_links.push({ ...(d.parent_student_links[0] as Row) }); })).toContain("duplicate link");
  });
  it("rejects rule violations (stars, Other note, capacity, enum, revision)", () => {
    expect(errs((d) => { (d.daily_checks[0] as Row).stars = null; })).toContain("Present needs 1-5 stars");
    expect(errs((d) => { (d.daily_checks[0] as Row).stars = 9; })).toContain("Present needs 1-5 stars");
    expect(errs((d) => { Object.assign(d.daily_checks[0] as Row, { status: "other", stars: null, note: " " }); })).toContain("Other needs a note");
    expect(errs((d) => { (d.rooms[0] as Row).capacity = 0; })).toContain("capacity");
    expect(errs((d) => { (d.rooms[0] as Row).publicAvailability = "maybe"; })).toContain("must be one of");
    expect(errs((d) => { (d.acknowledgements[0] as Row).revision = 99; })).toContain("revision");
  });
  it("rejects wrong types, bad dates, unexpected fields and missing tables", () => {
    expect(errs((d) => { (d.rooms[0] as Row).floor = "1"; })).toContain("whole number");
    expect(errs((d) => { (d.daily_checks[0] as Row).checkDate = "2026-02-30"; })).toContain("real date");
    expect(errs((d) => { (d.rooms[0] as Row).wardenPasswordHash = "x"; })).toContain("unexpected field");
    expect(validateBackupData({ rooms: [] }).ok).toBe(false);
    expect(validateBackupData(null).ok).toBe(false);
    expect(validateBackupData({ ...ok(), warden_accounts: [] }).ok).toBe(false);
  });
  it("archive-level: bad data / checksum / counts are rejected", () => {
    expect(errCode(() => openBackupArchive(forge((d) => { (d.students[0] as Row).roomId = u(999); }), PW))).toBe("invalid_data");
    expect(errCode(() => openBackupArchive(forge(undefined, undefined, '{"rooms":[]}'), PW))).toBe("corrupted"); // checksum mismatch
    expect(errCode(() => openBackupArchive(forge(undefined, (m) => { (m.counts as Record<string, number>).rooms = 5; }), PW))).toBe("invalid_data");
  });
  it("inspectBackup reports what would be restored and what expired, changing nothing", () => {
    const zip = createBackupArchive(rawData(), PW, NOW);
    const later = new Date("2026-11-15T10:00:00Z"); // the 1 Oct report is now older than 30 days
    const r = inspectBackup(zip, PW, later);
    expect(r.willRestore.daily_checks).toBe(0);
    expect(r.droppedExpired.daily_checks).toBe(1);
    expect(r.willRestore.rooms).toBe(1);
  });
});

// ------------------------------------------------------------------ restore orchestration
type State = Record<string, Row[]> & { parentSessions: Row[]; warden: Row[]; loginAttempts: Row[] };

function fakeStore(opts: { failOn?: TableName; failSafety?: boolean } = {}) {
  const live: State = {
    ...(Object.fromEntries(TABLE_NAMES.map((t) => [t, [{ marker: `live-${t}` }]])) as Record<string, Row[]>),
    parentSessions: [{ id: "s1" }, { id: "s2" }],
    warden: [{ loginId: "warden", passwordHash: "WARDEN-HASH" }],
    loginAttempts: [{ identifier: "x" }],
  };
  let state: State = structuredClone(live);
  const log: string[] = [];
  const store: RestoreStore = {
    async createSafetyBackup() {
      log.push("safety");
      if (opts.failSafety) throw new Error("storage full");
    },
    async transaction(fn) {
      log.push("begin");
      const draft: State = structuredClone(state);
      try {
        const out = await fn({
          async lock() { log.push("lock"); },
          async wipeIncluded() { for (const t of TABLE_NAMES) draft[t] = []; log.push("wipe"); },
          async insert(t, rows) {
            if (opts.failOn === t) throw new Error("constraint failed");
            draft[t] = rows.map((r) => ({ ...r }));
            log.push(`insert:${t}`);
          },
          async invalidateParentSessions() { draft.parentSessions = []; log.push("sessions"); },
        });
        state = draft;
        log.push("commit");
        return out;
      } catch (e) {
        log.push("rollback");
        throw e;
      }
    },
  };
  return { store, log, state: () => state, initial: live };
}

describe("restore flow: safety backup, one transaction, rollback", () => {
  const zip = () => createBackupArchive(rawData(), PW, NOW);

  it("creates the safety backup FIRST, then wipes + inserts in one transaction, then ends parent sessions", async () => {
    const f = fakeStore();
    const r = await restoreFromArchive(f.store, zip(), PW, NOW);
    expect(f.log).toEqual(["safety", "begin", "lock", "wipe", ...TABLE_NAMES.map((t) => `insert:${t}`), "sessions", "commit"]);
    expect(r.restored.rooms).toBe(1);
    expect(f.state().rooms).toHaveLength(1);
    expect((f.state().students[0] as Row).name).toBe("Dummy One");
    expect(f.state().parentSessions).toHaveLength(0);
  });
  it("never touches excluded security data (Warden account, login attempts)", async () => {
    const f = fakeStore();
    await restoreFromArchive(f.store, zip(), PW, NOW);
    expect(f.state().warden).toEqual(f.initial.warden);
    expect(f.state().loginAttempts).toEqual(f.initial.loginAttempts);
  });
  it("rolls everything back when any insert fails mid-restore", async () => {
    const f = fakeStore({ failOn: "daily_checks" });
    await expect(restoreFromArchive(f.store, zip(), PW, NOW)).rejects.toThrow();
    expect(f.state()).toEqual(f.initial); // live data exactly as before
    expect(f.log.indexOf("safety")).toBeLessThan(f.log.indexOf("begin"));
    expect(f.log.includes("rollback")).toBe(true);
    expect(f.log.includes("commit")).toBe(false);
  });
  it("aborts before any change when the safety backup cannot be created", async () => {
    const f = fakeStore({ failSafety: true });
    await expect(restoreFromArchive(f.store, zip(), PW, NOW)).rejects.toThrow();
    expect(f.log).toEqual(["safety"]);
    expect(f.state()).toEqual(f.initial);
  });
  it("invalid backups are rejected without touching the store at all", async () => {
    const cases = [
      { name: "wrong password", buf: zip(), pw: "wrong password here" },
      { name: "failed data validation", buf: forge((d) => { (d.students[0] as Row).roomId = u(999); }), pw: PW },
      { name: "newer schema version", buf: forge(undefined, (m) => { m.schema_version = 2; }), pw: PW },
    ];
    for (const c of cases) {
      const f = fakeStore();
      await expect(restoreFromArchive(f.store, c.buf, c.pw, NOW)).rejects.toBeInstanceOf(BackupError);
      expect(f.log).toEqual([]); // the store was never touched: no safety backup, no transaction
      expect(f.state()).toEqual(f.initial);
    }
    const f = fakeStore();
    await expect(restoreFromArchive(f.store, Buffer.from("junk"), PW, NOW)).rejects.toBeInstanceOf(BackupError);
    expect(f.log).toEqual([]);
  });
  it("restoring an old backup does not bring back expired data", async () => {
    const f = fakeStore();
    const r = await restoreFromArchive(f.store, zip(), PW, new Date("2026-11-15T10:00:00Z"));
    expect(r.droppedExpired.daily_checks).toBe(1);
    expect(r.droppedExpired.acknowledgements).toBe(1);
    expect(f.state().daily_checks).toHaveLength(0);
    expect(f.state().acknowledgements).toHaveLength(0);
    expect(f.state().rooms).toHaveLength(1); // permanent data is unaffected
  });
});

describe("backup password policy", () => {
  it("needs 12+ characters and a matching confirmation", () => {
    expect(checkBackupPassword("short")).toContain("at least");
    expect(checkBackupPassword("a-long-enough-password", "different")).toContain("do not match");
    expect(checkBackupPassword("a-long-enough-password", "a-long-enough-password")).toBeNull();
    expect(checkBackupPassword("x".repeat(129))).toContain("at most");
  });
});
