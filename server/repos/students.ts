import { and, asc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { getDb, type DbOrTx, type Tx } from "@/server/db/client";
import { rooms, students } from "@/server/db/schema";
import type { ImportSnapshot } from "@/server/lib/import-plan";

const studentColumns = {
  id: students.id,
  studentCode: students.studentCode,
  name: students.name,
  roomId: students.roomId,
  roomNumber: rooms.roomNumber,
  parentName: students.parentName,
  parentEmail: students.parentEmail,
  parentWhatsapp: students.parentWhatsapp,
  secondaryName: students.secondaryName,
  secondaryEmail: students.secondaryEmail,
  secondaryWhatsapp: students.secondaryWhatsapp,
  studentPhone: students.studentPhone,
  isActive: students.isActive,
  deactivatedAt: students.deactivatedAt,
};

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

export async function listStudents(
  filters: { q?: string; roomId?: string; status?: "active" | "inactive" | "all"; limit?: number },
  dbx: DbOrTx = getDb(),
) {
  const conds: SQL[] = [];
  if (filters.status === "active") conds.push(eq(students.isActive, true));
  if (filters.status === "inactive") conds.push(eq(students.isActive, false));
  if (filters.roomId) conds.push(eq(students.roomId, filters.roomId));
  if (filters.q?.trim()) {
    const like = `%${escapeLike(filters.q.trim())}%`;
    const match = or(ilike(students.name, like), ilike(students.studentCode, like), ilike(rooms.roomNumber, like), sql`${students.id}::text ilike ${like}`);
    if (match) conds.push(match);
  }
  return dbx
    .select(studentColumns)
    .from(students)
    .innerJoin(rooms, eq(rooms.id, students.roomId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(rooms.floor), asc(rooms.roomNumber), asc(students.name))
    .limit(Math.min(filters.limit ?? 500, 1000));
}

export type StudentRecord = NonNullable<Awaited<ReturnType<typeof findStudentById>>>;

export async function findStudentById(id: string, dbx: DbOrTx = getDb()) {
  const [row] = await dbx
    .select(studentColumns)
    .from(students)
    .innerJoin(rooms, eq(rooms.id, students.roomId))
    .where(eq(students.id, id))
    .limit(1);
  return row ?? null;
}

/** Locks the student row for the duration of the transaction. */
export async function findStudentForUpdate(id: string, tx: Tx) {
  const [row] = await tx.select().from(students).where(eq(students.id, id)).limit(1).for("update");
  return row ?? null;
}

type StudentWrite = {
  studentCode: string | null;
  name: string;
  roomId: string;
  parentName: string | null;
  parentEmail: string | null;
  parentWhatsapp: string;
  secondaryName: string | null;
  secondaryEmail: string | null;
  secondaryWhatsapp: string | null;
  studentPhone: string | null;
};

export async function insertStudent(values: StudentWrite, dbx: DbOrTx = getDb()) {
  const [row] = await dbx.insert(students).values(values).returning({ id: students.id });
  return row ?? null;
}

export async function insertStudents(values: StudentWrite[], dbx: DbOrTx = getDb()) {
  if (values.length === 0) return;
  await dbx.insert(students).values(values);
}

export async function updateStudentRow(
  id: string,
  set: Partial<StudentWrite & { isActive: boolean; deactivatedAt: Date | null }>,
  dbx: DbOrTx = getDb(),
) {
  await dbx.update(students).set(set).where(eq(students.id, id));
}

/** Everything the pure import planner needs, in one cheap read (a hostel has ~100 students). */
export async function loadImportSnapshot(dbx: DbOrTx = getDb()): Promise<ImportSnapshot> {
  const [roomRows, studentRows] = await Promise.all([
    dbx
      .select({ id: rooms.id, roomNumber: rooms.roomNumber, capacity: rooms.capacity, isActive: rooms.isActive })
      .from(rooms),
    dbx
      .select({
        id: students.id,
        studentCode: students.studentCode,
        name: students.name,
        roomId: students.roomId,
        isActive: students.isActive,
        parentWhatsapp: students.parentWhatsapp,
      })
      .from(students),
  ]);
  return { rooms: roomRows, students: studentRows };
}

export async function listActiveStudentsInRoom(roomId: string, dbx: DbOrTx = getDb()) {
  return dbx
    .select({ id: students.id, name: students.name })
    .from(students)
    .where(and(eq(students.roomId, roomId), eq(students.isActive, true)))
    .orderBy(asc(students.name));
}
