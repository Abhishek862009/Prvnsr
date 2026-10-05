import { eq, or, sql } from "drizzle-orm";
import { getDb, type DbOrTx } from "@/server/db/client";
import { wardenAccounts, wardenSessions } from "@/server/db/schema";

export async function findWardenByLoginId(loginId: string) {
  const [row] = await getDb().select().from(wardenAccounts).where(eq(wardenAccounts.loginId, loginId)).limit(1);
  return row ?? null;
}

export async function findSoleWarden() {
  const [row] = await getDb().select().from(wardenAccounts).limit(1);
  return row ?? null;
}

export async function createWarden(loginId: string, passwordHash: string) {
  const [row] = await getDb().insert(wardenAccounts).values({ loginId, passwordHash }).returning();
  return row ?? null;
}

export async function updateWardenPassword(wardenId: string, passwordHash: string, dbx: DbOrTx = getDb()) {
  await dbx.update(wardenAccounts).set({ passwordHash }).where(eq(wardenAccounts.id, wardenId));
}

/**
 * Single atomic statement: creates the one-and-only session row, or replaces the existing one
 * (remembering the old token hash so the old device learns it was replaced).
 */
export async function replaceWardenSession(args: { wardenId: string; tokenHash: string; expiresAt: Date }) {
  const now = new Date();
  await getDb()
    .insert(wardenSessions)
    .values({ wardenId: args.wardenId, tokenHash: args.tokenHash, expiresAt: args.expiresAt })
    .onConflictDoUpdate({
      target: wardenSessions.singleton,
      set: {
        wardenId: args.wardenId,
        previousTokenHash: sql`${wardenSessions.tokenHash}`,
        tokenHash: args.tokenHash,
        createdAt: now,
        lastSeenAt: now,
        expiresAt: args.expiresAt,
      },
    });
}

/** Finds the session row whose current OR previous token matches. */
export async function findWardenSessionByTokenHash(tokenHash: string) {
  const [row] = await getDb()
    .select({
      sessionId: wardenSessions.id,
      wardenId: wardenSessions.wardenId,
      tokenHash: wardenSessions.tokenHash,
      previousTokenHash: wardenSessions.previousTokenHash,
      createdAt: wardenSessions.createdAt,
      lastSeenAt: wardenSessions.lastSeenAt,
      expiresAt: wardenSessions.expiresAt,
      loginId: wardenAccounts.loginId,
    })
    .from(wardenSessions)
    .innerJoin(wardenAccounts, eq(wardenAccounts.id, wardenSessions.wardenId))
    .where(or(eq(wardenSessions.tokenHash, tokenHash), eq(wardenSessions.previousTokenHash, tokenHash)))
    .limit(1);
  return row ?? null;
}

export async function touchWardenSession(sessionId: string, now: Date) {
  await getDb().update(wardenSessions).set({ lastSeenAt: now }).where(eq(wardenSessions.id, sessionId));
}

export async function deleteWardenSessionByTokenHash(tokenHash: string) {
  await getDb().delete(wardenSessions).where(eq(wardenSessions.tokenHash, tokenHash));
}

export async function deleteAllWardenSessions(dbx: DbOrTx = getDb()) {
  await dbx.delete(wardenSessions);
}
