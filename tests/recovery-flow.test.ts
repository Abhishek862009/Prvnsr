import { describe, expect, it } from "vitest";
import { runRecovery, type RecoveryDeps } from "@/server/lib/recovery-flow";

const KEY = "the-master-recovery-key";
const ENCODED = Buffer.from(`HASH-OF-${KEY}`, "utf8").toString("base64");

/** In-memory "database": password hash, Warden sessions, throttle log. The reset is atomic. */
function setup(over: Partial<RecoveryDeps> & { throttled?: boolean; noWarden?: boolean; failReset?: boolean; policy?: "too_short" | "too_long" | null } = {}) {
  const db = { passwordHash: "OLD-HASH", sessions: ["sess-1"], failures: 0, successes: 0 };
  const calls: string[] = [];
  const deps: RecoveryDeps = {
    encodedKeyHash: ENCODED,
    isThrottled: async () => { calls.push("throttle?"); return !!over.throttled; },
    verifyKey: async (hash, key) => { calls.push("verify"); return hash === `HASH-OF-${KEY}` && key === KEY; },
    checkPassword: (p) => { calls.push("policy"); return over.policy !== undefined ? over.policy : p.length < 8 ? "too_short" : null; },
    findWardenId: async () => { calls.push("find"); return over.noWarden ? null : "warden-1"; },
    hashPassword: async (p) => { calls.push("hash"); return `NEW-HASH(${p})`; },
    resetPasswordAndSessions: async (_id, hash) => {
      calls.push("reset");
      const draft = { passwordHash: db.passwordHash, sessions: [...db.sessions] };
      draft.passwordHash = hash;
      draft.sessions = [];
      if (over.failReset) throw new Error("db down"); // transaction rolls back: draft is discarded
      db.passwordHash = draft.passwordHash;
      db.sessions = draft.sessions;
    },
    recordFailure: async () => { calls.push("fail"); db.failures++; },
    recordSuccess: async () => { calls.push("success"); db.successes++; },
    ...("encodedKeyHash" in over ? { encodedKeyHash: over.encodedKeyHash } : {}),
  };
  return { deps, db, calls };
}

describe("Warden forgot-password flow", () => {
  it("correct key + good password: password replaced AND all sessions ended, in that order", async () => {
    const s = setup();
    const r = await runRecovery(s.deps, KEY, "a-brand-new-pass");
    expect(r).toEqual({ ok: true });
    expect(s.db.passwordHash).toBe("NEW-HASH(a-brand-new-pass)");
    expect(s.db.sessions).toEqual([]); // existing Warden sessions invalidated
    expect(s.db.successes).toBe(1);
    expect(s.calls).toEqual(["throttle?", "policy", "verify", "find", "hash", "reset", "success"]);
  });
  it("the stored value is a hash of the new password, never the password or the recovery key", async () => {
    const s = setup();
    await runRecovery(s.deps, KEY, "a-brand-new-pass");
    expect(s.db.passwordHash.includes(KEY)).toBe(false);
  });
  it("wrong key: nothing changes, the failure is recorded, sessions survive", async () => {
    const s = setup();
    const r = await runRecovery(s.deps, "not-the-key", "a-brand-new-pass");
    expect(r).toEqual({ ok: false, reason: "wrong_key" });
    expect(s.db.passwordHash).toBe("OLD-HASH");
    expect(s.db.sessions).toEqual(["sess-1"]);
    expect(s.db.failures).toBe(1);
    expect(s.calls.includes("reset")).toBe(false);
    expect(s.calls.includes("hash")).toBe(false);
  });
  it("throttled: the key is not even checked, so guesses cannot be tested while locked", async () => {
    const s = setup({ throttled: true });
    expect(await runRecovery(s.deps, KEY, "a-brand-new-pass")).toEqual({ ok: false, reason: "throttled" });
    expect(s.calls).toEqual(["throttle?"]);
    expect(s.db.passwordHash).toBe("OLD-HASH");
  });
  it("weak password is rejected before the key is checked and does not count as a failed attempt", async () => {
    const s = setup();
    const r = await runRecovery(s.deps, KEY, "short");
    expect(r).toEqual({ ok: false, reason: "weak_password", policy: "too_short" });
    expect(s.calls.includes("verify")).toBe(false);
    expect(s.db.failures).toBe(0);
    expect(s.db.sessions).toEqual(["sess-1"]);
  });
  it("recovery is unavailable when no recovery key is configured (nothing runs)", async () => {
    const s = setup({ encodedKeyHash: undefined });
    expect(await runRecovery(s.deps, KEY, "a-brand-new-pass")).toEqual({ ok: false, reason: "unavailable" });
    expect(s.calls).toEqual([]);
  });
  it("no Warden account: unavailable, nothing is reset", async () => {
    const s = setup({ noWarden: true });
    expect(await runRecovery(s.deps, KEY, "a-brand-new-pass")).toEqual({ ok: false, reason: "unavailable" });
    expect(s.calls.includes("reset")).toBe(false);
  });
  it("if the database write fails the reset is all-or-nothing: old password AND sessions untouched, no success recorded", async () => {
    const s = setup({ failReset: true });
    await expect(runRecovery(s.deps, KEY, "a-brand-new-pass")).rejects.toThrow();
    expect(s.db.passwordHash).toBe("OLD-HASH");
    expect(s.db.sessions).toEqual(["sess-1"]);
    expect(s.db.successes).toBe(0);
  });
  it("the error result never contains the key or any hash", async () => {
    const s = setup();
    const r = await runRecovery(s.deps, "guess", "a-brand-new-pass");
    const text = JSON.stringify(r);
    for (const secret of [KEY, ENCODED, "HASH-OF-", "OLD-HASH"]) expect(text.includes(secret)).toBe(false);
  });
});
