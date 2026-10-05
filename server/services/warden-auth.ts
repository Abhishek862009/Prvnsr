import { SESSION_TOUCH_INTERVAL_MS, WARDEN_SESSION } from "@/server/config/auth";
import { getEnv } from "@/server/config/env";
import { getDb } from "@/server/db/client";
import { burnVerifyTime, checkPasswordPolicy, hashPassword, verifyPassword } from "@/server/auth/password";
import { runRecovery, type RecoveryResult } from "@/server/lib/recovery-flow";
import { generateToken, hashToken } from "@/server/auth/tokens";
import * as wardenRepo from "@/server/repos/warden";
import { isThrottled, recordFailure, recordSuccess } from "./throttle";

export type WardenLoginResult =
  | { ok: true; token: string; expiresAt: Date }
  | { ok: false; reason: "invalid" | "throttled" };

export type WardenSessionResult =
  | { ok: true; wardenId: string; loginId: string }
  | { ok: false; reason: "missing" | "invalid" | "expired" | "replaced" };

const normalizeLoginId = (s: string) => s.trim().toLowerCase();

export async function wardenLogin(loginIdInput: string, password: string, ip: string): Promise<WardenLoginResult> {
  const loginId = normalizeLoginId(loginIdInput);

  if (await isThrottled("warden", loginId, ip)) return { ok: false, reason: "throttled" };

  const account = await wardenRepo.findWardenByLoginId(loginId);
  if (!account) {
    await burnVerifyTime(password);
    await recordFailure("warden", loginId, ip);
    return { ok: false, reason: "invalid" };
  }
  if (!(await verifyPassword(account.passwordHash, password))) {
    await recordFailure("warden", loginId, ip);
    return { ok: false, reason: "invalid" };
  }

  const token = generateToken();
  const expiresAt = new Date(Date.now() + WARDEN_SESSION.absoluteMs);
  // Replaces any existing session: the previously signed-in device is signed out.
  await wardenRepo.replaceWardenSession({ wardenId: account.id, tokenHash: hashToken(token), expiresAt });
  await recordSuccess("warden", loginId, ip);
  return { ok: true, token, expiresAt };
}

export async function validateWardenSession(token: string | undefined): Promise<WardenSessionResult> {
  if (!token) return { ok: false, reason: "missing" };
  const tokenHash = hashToken(token);
  const row = await wardenRepo.findWardenSessionByTokenHash(tokenHash);
  if (!row) return { ok: false, reason: "invalid" };

  // Token matches only the previous slot: another device has signed in since.
  if (row.tokenHash !== tokenHash) return { ok: false, reason: "replaced" };

  const now = Date.now();
  const idleExpired = now - row.lastSeenAt.getTime() > WARDEN_SESSION.idleMs;
  if (row.expiresAt.getTime() <= now || idleExpired) {
    await wardenRepo.deleteWardenSessionByTokenHash(tokenHash);
    return { ok: false, reason: "expired" };
  }
  if (now - row.lastSeenAt.getTime() > SESSION_TOUCH_INTERVAL_MS) {
    await wardenRepo.touchWardenSession(row.sessionId, new Date(now));
  }
  return { ok: true, wardenId: row.wardenId, loginId: row.loginId };
}

export async function wardenLogout(token: string | undefined): Promise<void> {
  if (token) await wardenRepo.deleteWardenSessionByTokenHash(hashToken(token));
}

export type { RecoveryResult } from "@/server/lib/recovery-flow";

/**
 * Forgot-password flow: proves possession of the Master Recovery Key (only its hash lives in an
 * environment secret), sets a new password and signs out every session. The decision order lives in
 * `runRecovery` (unit-tested); this wires it to the real database.
 */
export async function recoverWardenPassword(recoveryKey: string, newPassword: string, ip: string): Promise<RecoveryResult> {
  const identifier = "__recovery__";
  return runRecovery(
    {
      encodedKeyHash: getEnv().RECOVERY_KEY_HASH,
      isThrottled: () => isThrottled("warden", identifier, ip),
      verifyKey: verifyPassword,
      checkPassword: checkPasswordPolicy,
      findWardenId: async () => (await wardenRepo.findSoleWarden())?.id ?? null,
      hashPassword,
      resetPasswordAndSessions: (wardenId, passwordHash) =>
        getDb().transaction(async (tx) => {
          await wardenRepo.updateWardenPassword(wardenId, passwordHash, tx);
          await wardenRepo.deleteAllWardenSessions(tx);
        }),
      recordFailure: () => recordFailure("warden", identifier, ip),
      recordSuccess: () => recordSuccess("warden", identifier, ip),
    },
    recoveryKey,
    newPassword,
  );
}
