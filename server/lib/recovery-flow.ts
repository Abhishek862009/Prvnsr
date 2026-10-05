/**
 * Warden "Forgot password" decision flow, with its dependencies injected so the ORDER of steps and the
 * all-or-nothing behaviour can be tested without a database.
 *
 *   no recovery key configured      -> unavailable (nothing else runs)
 *   too many recent attempts        -> throttled   (the key is NOT even checked)
 *   new password too weak           -> weak_password (key not checked, no failure recorded)
 *   wrong recovery key              -> wrong_key   (failure recorded, nothing changed)
 *   correct key                     -> password replaced AND every Warden session deleted in ONE transaction
 */
export type PolicyError = "too_short" | "too_long";

export type RecoveryResult =
  | { ok: true }
  | { ok: false; reason: "unavailable" | "throttled" | "wrong_key" | "weak_password"; policy?: PolicyError };

export interface RecoveryDeps {
  /** Base64 of the argon2 hash of the recovery key (from the environment); undefined = not configured. */
  encodedKeyHash: string | undefined;
  isThrottled(): Promise<boolean>;
  verifyKey(keyHash: string, key: string): Promise<boolean>;
  checkPassword(password: string): PolicyError | null;
  findWardenId(): Promise<string | null>;
  hashPassword(password: string): Promise<string>;
  /** MUST update the password and delete all Warden sessions atomically. */
  resetPasswordAndSessions(wardenId: string, passwordHash: string): Promise<void>;
  recordFailure(): Promise<void>;
  recordSuccess(): Promise<void>;
}

export async function runRecovery(deps: RecoveryDeps, recoveryKey: string, newPassword: string): Promise<RecoveryResult> {
  if (!deps.encodedKeyHash) return { ok: false, reason: "unavailable" };
  if (await deps.isThrottled()) return { ok: false, reason: "throttled" };

  const policy = deps.checkPassword(newPassword);
  if (policy) return { ok: false, reason: "weak_password", policy };

  const keyHash = Buffer.from(deps.encodedKeyHash, "base64").toString("utf8");
  if (!(await deps.verifyKey(keyHash, recoveryKey))) {
    await deps.recordFailure();
    return { ok: false, reason: "wrong_key" };
  }

  const wardenId = await deps.findWardenId();
  if (!wardenId) return { ok: false, reason: "unavailable" };

  await deps.resetPasswordAndSessions(wardenId, await deps.hashPassword(newPassword));
  await deps.recordSuccess();
  return { ok: true };
}
