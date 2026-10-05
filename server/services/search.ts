import { classifyQuery, matchRoomPrefix } from "@/server/lib/search";
import * as studentsRepo from "@/server/repos/students";
import { listRoomDays } from "./checking";

/**
 * Warden-only search (rooms first, then students). Never imported by the public site or the Parent
 * Portal; results include Warden-only information (parent numbers, today's room status).
 */
export async function wardenSearch(input: string, includeInactive = false) {
  const q = classifyQuery(input);
  if (q.kind === "empty") return { query: "", kind: "empty" as const, rooms: [], students: [] };

  const [days, found] = await Promise.all([
    q.kind === "room" ? listRoomDays() : Promise.resolve([]),
    studentsRepo.listStudents({ q: q.text, status: includeInactive ? "all" : "active", limit: 50 }),
  ]);
  return {
    query: q.text,
    kind: q.kind,
    rooms: matchRoomPrefix(days, q.text).map((r) => ({
      id: r.id,
      roomNumber: r.roomNumber,
      floor: r.floor,
      capacity: r.capacity,
      activeStudents: r.activeStudents,
      status: r.status,
    })),
    students: found.map((s) => ({
      id: s.id,
      studentCode: s.studentCode,
      name: s.name,
      roomNumber: s.roomNumber,
      isActive: s.isActive,
      parentName: s.parentName,
      parentWhatsapp: s.parentWhatsapp,
    })),
  };
}
