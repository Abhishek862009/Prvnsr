import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { getDb, type DbOrTx } from "@/server/db/client";
import { parentAccounts, parentSessions, parentStudentLinks, rooms, students } from "@/server/db/schema";

/** Warden-side parent account management. (Parent-side reads live in repos/parents.ts.) */
export async function listParentAccounts(dbx: DbOrTx = getDb()) {
  return dbx
    .select({
      id: parentAccounts.id,
      mobileE164: parentAccounts.mobileE164,
      mustChangePassword: parentAccounts.mustChangePassword,
      lastLoginAt: parentAccounts.lastLoginAt,
      createdAt: parentAccounts.createdAt,
    })
    .from(parentAccounts)
    .orderBy(asc(parentAccounts.mobileE164));
}

export async function listAllLinks(dbx: DbOrTx = getDb()) {
  return dbx.select({ parentId: parentStudentLinks.parentId, studentId: parentStudentLinks.studentId }).from(parentStudentLinks);
}

export async function listStudentsForLinking(dbx: DbOrTx = getDb()) {
  return dbx
    .select({
      studentId: students.id,
      name: students.name,
      roomNumber: rooms.roomNumber,
      parentWhatsapp: students.parentWhatsapp,
      isActive: students.isActive,
    })
    .from(students)
    .innerJoin(rooms, eq(rooms.id, students.roomId))
    .orderBy(asc(rooms.roomNumber), asc(students.name));
}

export async function countExistingStudents(ids: string[], dbx: DbOrTx = getDb()) {
  if (ids.length === 0) return 0;
  const [row] = await dbx.select({ n: sql<number>`count(*)::int` }).from(students).where(inArray(students.id, ids));
  return row?.n ?? 0;
}

export async function insertAccount(args: { mobileE164: string; passwordHash: string }, dbx: DbOrTx = getDb()) {
  const [row] = await dbx
    .insert(parentAccounts)
    .values({ mobileE164: args.mobileE164, passwordHash: args.passwordHash, mustChangePassword: true })
    .returning({ id: parentAccounts.id, mobileE164: parentAccounts.mobileE164 });
  return row ?? null;
}

export async function insertLinks(parentId: string, studentIds: string[], dbx: DbOrTx = getDb()) {
  if (studentIds.length === 0) return;
  await dbx.insert(parentStudentLinks).values(studentIds.map((studentId) => ({ parentId, studentId }))).onConflictDoNothing();
}

export async function deleteLink(parentId: string, studentId: string, dbx: DbOrTx = getDb()) {
  const rows = await dbx
    .delete(parentStudentLinks)
    .where(and(eq(parentStudentLinks.parentId, parentId), eq(parentStudentLinks.studentId, studentId)))
    .returning({ studentId: parentStudentLinks.studentId });
  return rows.length > 0;
}

export async function countLinks(parentId: string, dbx: DbOrTx = getDb()) {
  const [row] = await dbx.select({ n: sql<number>`count(*)::int` }).from(parentStudentLinks).where(eq(parentStudentLinks.parentId, parentId));
  return row?.n ?? 0;
}

export async function updateMobile(parentId: string, mobileE164: string, dbx: DbOrTx = getDb()) {
  const [row] = await dbx.update(parentAccounts).set({ mobileE164 }).where(eq(parentAccounts.id, parentId)).returning({ id: parentAccounts.id });
  return row ?? null;
}

export async function deleteAccount(parentId: string, dbx: DbOrTx = getDb()) {
  await dbx.delete(parentSessions).where(eq(parentSessions.parentId, parentId));
  const rows = await dbx.delete(parentAccounts).where(eq(parentAccounts.id, parentId)).returning({ id: parentAccounts.id });
  return rows.length > 0;
}
