import { createHmac, randomBytes } from "node:crypto";
import { getEnv } from "@/server/config/env";

/** 256-bit random session token sent to the browser. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Only this keyed hash is stored, so a database leak does not expose usable session tokens. */
export function hashToken(token: string): string {
  return createHmac("sha256", getEnv().SESSION_SECRET).update(token).digest("hex");
}
