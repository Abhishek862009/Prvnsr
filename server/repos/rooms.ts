import { asc, eq, sql } from "drizzle-orm";
import { getDb, type DbOrTx, type Tx } from "@/server/db/client";
import { dailyChecks, rooms, students } from "@/server/db/schema";

export async function listRoomsWithOccupancy(dbx: DbOrTx = getDb()) {
  return dbx
    .select({
      id: rooms.id,
      roomNumber: rooms.roomNumber,
      floor: rooms.floor,
      capacity: rooms.capacity,
      isActive: rooms.isActive,
      publicAvailability: rooms.publicAvailability,
      activeStudents: sql<number>`(select count(*)::int from ${students} where ${students.roomId} = ${rooms.id} and ${students.isActive})`,
    })
    .from(rooms)
    .orderBy(asc(rooms.floor), asc(rooms.roomNumber));
}

export async function findRoomById(id: string, dbx: DbOrTx = getDb()) {
  const [row] = await dbx.select().from(rooms).where(eq(rooms.id, id)).limit(1);
  return row ?? null;
}

/** Row lock: serialises capacity checks for the same room inside a transaction. */
export async function findRoomForUpdate(id: string, tx: Tx) {
  const [row] = await tx.select().from(rooms).where(eq(rooms.id, id)).limit(1).for("update");
  return row ?? null;
}

export async function lockAllRooms(tx: Tx) {
  await tx.select({ id: rooms.id }).from(rooms).orderBy(asc(rooms.id)).for("update");
}

export async function insertRoom(values: { roomNumber: string; floor: number; capacity: number }, dbx: DbOrTx = getDb()) {
  const [row] = await dbx.insert(rooms).values(values).returning();
  return row ?? null;
}

export async function updateRoomRow(
  id: string,
  set: Partial<{ roomNumber: string; floor: number; capacity: number; isActive: boolean; publicAvailability: "available" | "full" }>,
  dbx: DbOrTx = getDb(),
) {
  const [row] = await dbx.update(rooms).set(set).where(eq(rooms.id, id)).returning();
  return row ?? null;
}

export async function countActiveStudentsInRoom(roomId: string, dbx: DbOrTx = getDb()) {
  const [row] = await dbx
    .select({ n: sql<number>`count(*)::int` })
    .from(students)
    .where(sql`${students.roomId} = ${roomId} and ${students.isActive}`);
  return row?.n ?? 0;
}

export async function insertRooms(values: { roomNumber: string; floor: number; capacity: number }[], dbx: DbOrTx = getDb()) {
  if (values.length === 0) return;
  await dbx.insert(rooms).values(values);
}

export async function loadRoomImportSnapshot(dbx: DbOrTx = getDb()) {
  const list = await listRoomsWithOccupancy(dbx);
  return {
    rooms: list.map((r) => ({
      id: r.id,
      roomNumber: r.roomNumber,
      capacity: r.capacity,
      isActive: r.isActive,
      activeStudents: r.activeStudents,
    })),
  };
}

export async function findRoomByNumber(roomNumber: string, dbx: DbOrTx = getDb()) {
  const [row] = await dbx.select().from(rooms).where(eq(rooms.roomNumber, roomNumber)).limit(1);
  return row ?? null;
}

/** Public site: ONLY the room number and the manually set availability of ACTIVE rooms. */
export async function listPublicRooms(dbx: DbOrTx = getDb()) {
  return dbx
    .select({ roomNumber: rooms.roomNumber, publicAvailability: rooms.publicAvailability })
    .from(rooms)
    .where(eq(rooms.isActive, true))
    .orderBy(asc(rooms.floor), asc(rooms.roomNumber));
}

/** True while retained checking records were saved under this room number (rename guard). */
export async function hasChecksWithRoomSnapshot(roomNumber: string, dbx: DbOrTx = getDb()) {
  const rows = await dbx.select({ id: dailyChecks.id }).from(dailyChecks).where(eq(dailyChecks.roomNumberSnapshot, roomNumber)).limit(1);
  return rows.length > 0;
}
