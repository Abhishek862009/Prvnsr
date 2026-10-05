/**
 * Loads DUMMY data into a DEVELOPMENT database.
 * Refuses to run in production, without SEED_ALLOWED=true, or when data already exists.
 */
import { checkPasswordPolicy, hashPassword } from "@/server/auth/password";
import { getDb } from "@/server/db/client";
import { parentAccounts, parentStudentLinks, rooms, students } from "@/server/db/schema";
import { deriveFloor } from "@/server/lib/rooms";
import { normalizePhone } from "@/server/lib/phone";
import { dummyRooms, dummyStudents } from "@/seed/dummy-data";

function die(msg: string): never {
  console.error(`Seed aborted: ${msg}`);
  process.exit(1);
}

async function main() {
  if (process.env.NODE_ENV === "production") die("NODE_ENV is production.");
  if (process.env.SEED_ALLOWED !== "true") die("set SEED_ALLOWED=true in your development .env.local only.");

  const password = process.env.SEED_PARENT_PASSWORD ?? "";
  if (checkPasswordPolicy(password)) die("set SEED_PARENT_PASSWORD (8+ chars). It is the dummy parents' temporary password.");

  const db = getDb();
  const existingRooms = await db.select({ id: rooms.id }).from(rooms).limit(1);
  const existingStudents = await db.select({ id: students.id }).from(students).limit(1);
  if (existingRooms.length || existingStudents.length) die("database already has rooms/students. Use an empty development branch.");

  const passwordHash = await hashPassword(password);

  await db.transaction(async (tx) => {
    const roomRows = await tx
      .insert(rooms)
      .values(
        dummyRooms.map((r) => {
          const floor = deriveFloor(r.roomNumber);
          if (floor === null) throw new Error(`Bad room number ${r.roomNumber}`);
          const occupants = dummyStudents.filter((s) => s.roomNumber === r.roomNumber).length;
          return {
            roomNumber: r.roomNumber,
            floor,
            capacity: r.capacity,
            publicAvailability: occupants >= r.capacity ? ("full" as const) : ("available" as const),
          };
        }),
      )
      .returning({ id: rooms.id, roomNumber: rooms.roomNumber });
    const roomId = new Map(roomRows.map((r) => [r.roomNumber, r.id]));

    const studentRows = await tx
      .insert(students)
      .values(
        dummyStudents.map((s) => {
          const e164 = normalizePhone(s.parentWhatsapp);
          const rid = roomId.get(s.roomNumber);
          if (!e164 || !rid) throw new Error(`Bad dummy data for ${s.code}`);
          return {
            studentCode: s.code,
            name: s.name,
            roomId: rid,
            parentName: s.parentName,
            parentEmail: s.parentEmail,
            parentWhatsapp: e164,
          };
        }),
      )
      .returning({ id: students.id, studentCode: students.studentCode, parentWhatsapp: students.parentWhatsapp });

    // One parent account per unique primary number; links are explicit (never auto-guessed at runtime).
    const numbers = [...new Set(studentRows.map((s) => s.parentWhatsapp).filter((n): n is string => !!n))];
    const parentRows = await tx
      .insert(parentAccounts)
      .values(numbers.map((mobileE164) => ({ mobileE164, passwordHash, mustChangePassword: true })))
      .returning({ id: parentAccounts.id, mobileE164: parentAccounts.mobileE164 });
    const parentId = new Map(parentRows.map((p) => [p.mobileE164, p.id]));

    await tx.insert(parentStudentLinks).values(
      studentRows.map((s) => {
        const pid = s.parentWhatsapp ? parentId.get(s.parentWhatsapp) : undefined;
        if (!pid) throw new Error("Missing parent for dummy student");
        return { parentId: pid, studentId: s.id };
      }),
    );
  });

  console.log(`Seeded ${dummyRooms.length} dummy rooms, ${dummyStudents.length} dummy students and their parent accounts.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err instanceof Error ? err.message : "unknown error");
  process.exit(1);
});
