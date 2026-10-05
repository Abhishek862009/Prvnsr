import { PARENT_SESSION, SESSION_TOUCH_INTERVAL_MS } from "@/server/config/auth";
import { getDb } from "@/server/db/client";
import { burnVerifyTime, checkPasswordPolicy, hashPassword, verifyPassword, type PasswordPolicyError } from "@/server/auth/password";
import { generateToken, hashToken } from "@/server/auth/tokens";
import { normalizePhone } from "@/server/lib/phone";
import * as parentsRepo from "@/server/repos/parents";
import { isThrottled, recordFailure, recordSuccess } from "./throttle";

export type ParentLoginResult =
  | { ok: true; token: string; expiresAt: Date; mustChangePassword: boolean }
  | { ok: false; reason: "invalid" | "throttled" };

export type ParentSession = { parentId: string; mobileE164: string; mustChangePassword: boolean };

export async function parentLogin(mobileInput: string, password: string, ip: string): Promise<ParentLoginResult> {
  const mobile = normalizePhone(mobileInput);
  // Throttle on the normalised number when valid, otherwise on the raw input.
  const identifier = mobile ?? `invalid:${mobileInput.trim()}`;

  if (await isThrottled("parent", identifier, ip)) return { ok: false, reason: "throttled" };

  const account = mobile ? await parentsRepo.findParentByMobile(mobile) : null;
  if (!account) {
    await burnVerifyTime(password);
    await recordFailure("parent", identifier, ip);
    return { ok: false, reason: "invalid" };
  }
  if (!(await verifyPassword(account.passwordHash, password))) {
    await recordFailure("parent", identifier, ip);
    return { ok: false, reason: "invalid" };
  }

  const token = generateToken();
  const expiresAt = new Date(Date.now() + PARENT_SESSION.absoluteMs);
  await parentsRepo.insertParentSession({ parentId: account.id, tokenHash: hashToken(token), expiresAt });
  await parentsRepo.markParentLogin(account.id);
  await recordSuccess("parent", identifier, ip);
  return { ok: true, token, expiresAt, mustChangePassword: account.mustChangePassword };
}

export async function validateParentSession(token: string | undefined): Promise<ParentSession | null> {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const row = await parentsRepo.findParentSessionByTokenHash(tokenHash);
  if (!row) return null;

  const now = Date.now();
  if (row.expiresAt.getTime() <= now || now - row.lastSeenAt.getTime() > PARENT_SESSION.idleMs) {
    await parentsRepo.deleteParentSessionByTokenHash(tokenHash);
    return null;
  }
  if (now - row.lastSeenAt.getTime() > SESSION_TOUCH_INTERVAL_MS) {
    await parentsRepo.touchParentSession(row.sessionId, new Date(now));
  }
  return { parentId: row.parentId, mobileE164: row.mobileE164, mustChangePassword: row.mustChangePassword };
}

export async function parentLogout(token: string | undefined): Promise<void> {
  if (token) await parentsRepo.deleteParentSessionByTokenHash(hashToken(token));
}

export type ChangePasswordResult =
  | { ok: true }
  | { ok: false; reason: "wrong_current" | "same_password" | "weak_password"; policy?: PasswordPolicyError };

/** Parent changes own password. Clears must_change flag and signs out the parent's other sessions. */
export async function changeParentPassword(args: {
  parentId: string;
  currentToken: string;
  currentPassword: string;
  newPassword: string;
}): Promise<ChangePasswordResult> {
  const policy = checkPasswordPolicy(args.newPassword);
  if (policy) return { ok: false, reason: "weak_password", policy };

  const account = await parentsRepo.findParentById(args.parentId);
  if (!account || !(await verifyPassword(account.passwordHash, args.currentPassword))) {
    return { ok: false, reason: "wrong_current" };
  }
  if (args.currentPassword === args.newPassword) return { ok: false, reason: "same_password" };

  const newHash = await hashPassword(args.newPassword);
  await getDb().transaction(async (tx) => {
    await parentsRepo.setParentPassword(account.id, newHash, false, tx);
    await parentsRepo.deleteParentSessions(account.id, hashToken(args.currentToken), tx);
  });
  return { ok: true };
}

/**
 * Warden/Admin sets a temporary password (first setup or forgot-password reset).
 * Forces a change on next login and signs the parent out everywhere.
 * Used by the Warden panel in a later step.
 */
export async function adminSetParentTemporaryPassword(parentId: string, temporaryPassword: string) {
  const policy = checkPasswordPolicy(temporaryPassword);
  if (policy) return { ok: false as const, reason: "weak_password" as const, policy };
  const hash = await hashPassword(temporaryPassword);
  await getDb().transaction(async (tx) => {
    await parentsRepo.setParentPassword(parentId, hash, true, tx);
    await parentsRepo.deleteParentSessions(parentId, undefined, tx);
  });
  return { ok: true as const };
}
