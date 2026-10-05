import { addDays } from "./dates";
import { starSummary } from "./parent-report";
import { retentionCutoffs } from "./retention";
import { compareRoomNumbers } from "./room-status";
import type { AckState } from "./parent-report";
import type { WhatsAppState } from "./whatsapp";

export type HistoryView = "date" | "student" | "room";
export type StarsFilter = 1 | 2 | 3 | 4 | 5 | "none";

export type HistoryFilters = {
  view: HistoryView;
  from: string;
  to: string;
  room: string | null;
  q: string;
  status: "present" | "absent" | "other" | null;
  stars: StarsFilter | null;
  page: number;
};

export type HistoryRow = {
  id: string;
  date: string;
  studentId: string;
  studentName: string;
  studentCode: string | null;
  studentActive: boolean;
  roomNumber: string; // the room on THAT day (snapshot)
  status: "present" | "absent" | "other";
  stars: number | null;
  note: string;
  roomNote: string;
  revision: number;
  lastEditedAt: Date | null;
  whatsapp: { state: WhatsAppState; openedAt: Date | null };
  ack: { state: AckState; at: Date | null };
};

const isDate = (v: string | undefined): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && addDays(v, 0) === v;

/**
 * Reads the URL filters. Whatever is typed, the date range is clamped to the retained window
 * (today and the 29 days before it, IST), so data past retention is never shown even if cleanup has not run yet.
 */
export function parseHistoryParams(sp: Record<string, string | undefined>, now: Date): HistoryFilters {
  const c = retentionCutoffs(now);
  const clamp = (d: string) => (d < c.checkingKeepFrom ? c.checkingKeepFrom : d > c.today ? c.today : d);
  let from = isDate(sp.from) ? clamp(sp.from) : c.checkingKeepFrom;
  let to = isDate(sp.to) ? clamp(sp.to) : c.today;
  if (from > to) [from, to] = [to, from];

  const status = sp.status === "present" || sp.status === "absent" || sp.status === "other" ? sp.status : null;
  const n = Number(sp.stars);
  const stars: StarsFilter | null = sp.stars === "none" ? "none" : Number.isInteger(n) && n >= 1 && n <= 5 ? (n as StarsFilter) : null;
  const page = Number.isInteger(Number(sp.page)) && Number(sp.page) >= 1 ? Number(sp.page) : 1;
  return {
    view: sp.view === "student" || sp.view === "room" ? sp.view : "date",
    from,
    to,
    room: sp.room && /^\d{3,4}$/.test(sp.room) ? sp.room : null,
    q: (sp.q ?? "").trim().slice(0, 60),
    status,
    stars,
    page,
  };
}

export function filterHistory(rows: readonly HistoryRow[], f: HistoryFilters): HistoryRow[] {
  const q = f.q.toLowerCase();
  return rows.filter((r) => {
    if (r.date < f.from || r.date > f.to) return false;
    if (f.room && r.roomNumber !== f.room) return false;
    if (f.status && r.status !== f.status) return false;
    if (f.stars === "none" ? r.stars !== null : f.stars !== null && r.stars !== f.stars) return false;
    if (q && !r.studentName.toLowerCase().includes(q) && !(r.studentCode ?? "").toLowerCase().includes(q)) return false;
    return true;
  });
}

/** Latest date first; within a day by room number, then name. */
export function sortHistory(rows: readonly HistoryRow[]): HistoryRow[] {
  return [...rows].sort((a, b) => b.date.localeCompare(a.date) || compareRoomNumbers(a.roomNumber, b.roomNumber) || a.studentName.localeCompare(b.studentName));
}

type Summary = { days: number; present: number; absent: number; other: number; average: number | null; ratedDays: number };
const summarize = (rows: readonly HistoryRow[]): Summary => {
  const s = starSummary(rows);
  return {
    days: rows.length,
    present: rows.filter((r) => r.status === "present").length,
    absent: rows.filter((r) => r.status === "absent").length,
    other: rows.filter((r) => r.status === "other").length,
    average: s.average,
    ratedDays: s.ratedDays,
  };
};

export type StudentGroup = { studentId: string; name: string; code: string | null; active: boolean; rooms: string[]; summary: Summary; rows: HistoryRow[] };

/** Student-wise view: one group per student, their days latest first. */
export function groupByStudent(rows: readonly HistoryRow[]): StudentGroup[] {
  const map = new Map<string, HistoryRow[]>();
  for (const r of sortHistory(rows)) map.set(r.studentId, [...(map.get(r.studentId) ?? []), r]);
  return [...map.values()]
    .map((list) => {
      const first = list[0] as HistoryRow;
      return {
        studentId: first.studentId,
        name: first.studentName,
        code: first.studentCode,
        active: first.studentActive,
        rooms: [...new Set(list.map((r) => r.roomNumber))].sort(compareRoomNumbers),
        summary: summarize(list),
        rows: list,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type RoomGroup = { roomNumber: string; summary: Summary; days: { date: string; roomNote: string; rows: HistoryRow[] }[] };

/** Room-wise view: one group per room (as it was on those days); each day shows the room note once. */
export function groupByRoom(rows: readonly HistoryRow[]): RoomGroup[] {
  const byRoom = new Map<string, HistoryRow[]>();
  for (const r of sortHistory(rows)) byRoom.set(r.roomNumber, [...(byRoom.get(r.roomNumber) ?? []), r]);
  return [...byRoom.entries()]
    .sort((a, b) => compareRoomNumbers(a[0], b[0]))
    .map(([roomNumber, list]) => {
      const days = new Map<string, HistoryRow[]>();
      for (const r of list) days.set(r.date, [...(days.get(r.date) ?? []), r]);
      return {
        roomNumber,
        summary: summarize(list),
        days: [...days.entries()].map(([date, rs]) => ({ date, roomNote: rs.find((x) => x.roomNote)?.roomNote ?? "", rows: rs })),
      };
    });
}

export function paginate<T>(items: readonly T[], page: number, size: number): { items: T[]; page: number; pages: number; total: number } {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const p = Math.min(Math.max(1, page), pages);
  return { items: items.slice((p - 1) * size, p * size), page: p, pages, total: items.length };
}
