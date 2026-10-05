import { hash, verify } from "@node-rs/argon2";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/server/config/auth";

// Argon2id (library default) with OWASP-recommended minimum parameters.
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false; // malformed hash must never grant access
  }
}

export type PasswordPolicyError = "too_short" | "too_long";

export function checkPasswordPolicy(password: string): PasswordPolicyError | null {
  if (password.length < PASSWORD_MIN) return "too_short";
  if (password.length > PASSWORD_MAX) return "too_long";
  return null;
}

let dummyHash: Promise<string> | undefined;

/**
 * Verifies against a throwaway hash so "unknown user" takes the same time as "wrong password"
 * (prevents account enumeration by timing).
 */
export async function burnVerifyTime(password: string): Promise<void> {
  dummyHash ??= hashPassword(`dummy-${Math.random()}-${Date.now()}`);
  await verifyPassword(await dummyHash, password);
}
