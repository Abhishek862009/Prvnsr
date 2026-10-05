import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { loginAttempts } from "@/server/db/schema";

type Scope = "warden" | "parent";

export async function countRecentFailuresByIdentifier(scope: Scope, identifier: string, since: Date) {
  const [row] = await getDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.scope, scope),
        eq(loginAttempts.identifier, identifier),
        eq(loginAttempts.success, false),
        gte(loginAttempts.attemptedAt, since),
      ),
    );
  return row?.n ?? 0;
}

export async function countRecentFailuresByIp(scope: Scope, ip: string, since: Date) {
  const [row] = await getDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.scope, scope),
        eq(loginAttempts.ipAddress, ip),
        eq(loginAttempts.success, false),
        gte(loginAttempts.attemptedAt, since),
      ),
    );
  return row?.n ?? 0;
}

export async function insertAttempt(scope: Scope, identifier: string, ip: string, success: boolean) {
  await getDb().insert(loginAttempts).values({ scope, identifier, ipAddress: ip, success });
}

/** After a successful login the identifier's failure counter starts fresh. */
export async function clearFailures(scope: Scope, identifier: string) {
  await getDb()
    .delete(loginAttempts)
    .where(
      and(eq(loginAttempts.scope, scope), eq(loginAttempts.identifier, identifier), eq(loginAttempts.success, false)),
    );
}
