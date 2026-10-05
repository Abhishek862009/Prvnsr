import { THROTTLE } from "@/server/config/auth";
import * as attempts from "@/server/repos/login-attempts";

type Scope = "warden" | "parent";

const clip = (s: string) => s.slice(0, 64);

export async function isThrottled(scope: Scope, identifier: string, ip: string): Promise<boolean> {
  const since = new Date(Date.now() - THROTTLE.windowMs);
  const [byId, byIp] = await Promise.all([
    attempts.countRecentFailuresByIdentifier(scope, clip(identifier), since),
    attempts.countRecentFailuresByIp(scope, clip(ip), since),
  ]);
  return byId >= THROTTLE.maxFailuresPerIdentifier || byIp >= THROTTLE.maxFailuresPerIp;
}

export async function recordFailure(scope: Scope, identifier: string, ip: string) {
  await attempts.insertAttempt(scope, clip(identifier), clip(ip), false);
}

export async function recordSuccess(scope: Scope, identifier: string, ip: string) {
  await attempts.clearFailures(scope, clip(identifier));
  await attempts.insertAttempt(scope, clip(identifier), clip(ip), true);
}
