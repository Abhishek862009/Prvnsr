import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Cron/scheduler authorisation: `Authorization: Bearer <CRON_SECRET>`.
 * Works with any scheduler (Vercel Cron sends exactly this header; so can curl or GitHub Actions).
 * A missing or short secret means NOTHING is authorised (fail closed).
 */
export function isCronAuthorized(authorizationHeader: string | null | undefined, secret: string | undefined): boolean {
  if (!secret || secret.length < 24) return false;
  const given = /^Bearer (.+)$/.exec(authorizationHeader ?? "")?.[1];
  if (!given) return false;
  // Hash both so the comparison is constant-time even for different lengths.
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}
