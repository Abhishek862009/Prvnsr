import { and, eq, ne } from "drizzle-orm";
import { getDb, type DbOrTx } from "@/server/db/client";
import { parentAccounts, parentSessions, parentStudentLinks, rooms, students } from "@/server/db/schema";

export async function findParentByMobile(mobileE164: string) {
  const [row] = await getDb().select().from(parentAccounts).where(eq(parentAccounts.mobileE164, mobileE164)).limit(1);
  return row ?? null;
}

export async function findParentById(parentId: string) {
  const [row] = await getDb().select().from(parentAccounts).where(eq(parentAccounts.id, parentId)).limit(1);
  return row ?? null;
}

export async function createParentAccount(args: { mobileE164: string; passwordHash: string; mustChangePassword?: boolean }) {
  const [row] = await getDb()
    .insert(parentAccounts)
    .values({ ...args, mustChangePassword: args.mustChangePassword ?? true })
    .returning();
  return row ?? null;
}

export async function setParentPassword(
  parentId: string,
  passwordHash: string,
  mustChangePassword: boolean,
  dbx: DbOrTx = getDb(),
) {
  await dbx
    .update(parentAccounts)
    .set({ passwordHash, mustChangePassword, passwordChangedAt: mustChangePassword ? null : new Date() })
    .where(eq(parentAccounts.id, parentId));
}

export async function markParentLogin(parentId: string) {
  await getDb().update(parentAccounts).set({ lastLoginAt: new Date() }).where(eq(parentAccounts.id, parentId));
}

// ----- sessions -----
export async function insertParentSession(args: { parentId: string; tokenHash: string; expiresAt: Date }) {
  await getDb().insert(parentSessions).values(args);
}

export async function findParentSessionByTokenHash(tokenHash: string) {
  const [row] = await getDb()
    .select({
      sessionId: parentSessions.id,
      parentId: parentSessions.parentId,
      createdAt: parentSessions.createdAt,
      lastSeenAt: parentSessions.lastSeenAt,
      expiresAt: parentSessions.expiresAt,
      mobileE164: parentAccounts.mobileE164,
      mustChangePassword: parentAccounts.mustChangePassword,
    })
    .from(parentSessions)
    .innerJoin(parentAccounts, eq(parentAccounts.id, parentSessions.parentId))
    .where(eq(parentSessions.tokenHash, tokenHash))
    .limit(1);
  return row ?? null;
}

export async function touchParentSession(sessionId: string, now: Date) {
  await getDb().update(parentSessions).set({ lastSeenAt: now }).where(eq(parentSessions.id, sessionId));
}

export async function deleteParentSessionByTokenHash(tokenHash: string) {
  await getDb().delete(parentSessions).where(eq(parentSessions.tokenHash, tokenHash));
}

/** Deletes all of a parent's sessions, optionally keeping one (used after a password change). */
export async function deleteParentSessions(parentId: string, exceptTokenHash?: string, dbx: DbOrTx = getDb()) {
  await dbx
    .delete(parentSessions)
    .where(
      exceptTokenHash
        ? and(eq(parentSessions.parentId, parentId), ne(parentSessions.tokenHash, exceptTokenHash))
        : eq(parentSessions.parentId, parentId),
    );
}

// ----- linked students (authorization source of truth) -----
export async function listLinkedStudents(parentId: string) {
  return getDb()
    .select({
      studentId: students.id,
      name: students.name,
      roomNumber: rooms.roomNumber,
      isActive: students.isActive,
    })
    .from(parentStudentLinks)
    .innerJoin(students, eq(students.id, parentStudentLinks.studentId))
    .innerJoin(rooms, eq(rooms.id, students.roomId))
    .where(eq(parentStudentLinks.parentId, parentId))
    .orderBy(students.name);
}

/** Returns the student only if this parent is linked to it. */
export async function findLinkedStudent(parentId: string, studentId: string) {
  const [row] = await getDb()
    .select({
      studentId: students.id,
      isActive: students.isActive,
      deactivatedAt: students.deactivatedAt,
    })
    .from(parentStudentLinks)
    .innerJoin(students, eq(students.id, parentStudentLinks.studentId))
    .where(and(eq(parentStudentLinks.parentId, parentId), eq(parentStudentLinks.studentId, studentId)))
    .limit(1);
  return row ?? null;
}
