import {
  filterHistory, groupByRoom, groupByStudent, paginate, parseHistoryParams, sortHistory, type HistoryRow,
} from "@/server/lib/history";
import { summarizeAcks } from "@/server/lib/parent-report";
import { compareRoomNumbers } from "@/server/lib/room-status";
import { latestOpen, whatsappState } from "@/server/lib/whatsapp";
import * as reportsRepo from "@/server/repos/parent-reports";
import * as deliveryRepo from "@/server/repos/reports";
import * as historyRepo from "@/server/repos/warden-history";

const PAGE_SIZE = { date: 100, student: 15, room: 10 } as const;

/**
 * Warden-only 30-day history. The window is clamped to the retention period (IST), so anything older
 * simply is not shown, and disappears from the database when the daily cleanup runs.
 */
export async function getWardenHistory(sp: Record<string, string | undefined>, now: Date = new Date()) {
  const filters = parseHistoryParams(sp, now);
  const base = await historyRepo.listHistoryRows({ from: filters.from, to: filters.to });
  const ids = base.map((r) => r.id);
  const [opens, acks] = await Promise.all([deliveryRepo.listWhatsappOpens(ids), reportsRepo.listAcknowledgementsForChecks(ids)]);

  const opensBy = new Map<string, typeof opens>();
  for (const o of opens) opensBy.set(o.dailyCheckId, [...(opensBy.get(o.dailyCheckId) ?? []), o]);
  const acksBy = new Map<string, typeof acks>();
  for (const a of acks) acksBy.set(a.dailyCheckId, [...(acksBy.get(a.dailyCheckId) ?? []), a]);

  const rows: HistoryRow[] = base.map((r) => {
    const mine = opensBy.get(r.id) ?? [];
    return {
      ...r,
      roomNote: r.roomNote ?? "",
      whatsapp: { state: whatsappState(r.revision, mine.map((o) => o.revision)), openedAt: latestOpen(mine)?.openedAt ?? null },
      ack: summarizeAcks(r.revision, acksBy.get(r.id) ?? []),
    };
  });

  const filtered = filterHistory(rows, filters);
  const roomOptions = [...new Set(rows.map((r) => r.roomNumber))].sort(compareRoomNumbers);
  const totals = { reports: filtered.length, students: new Set(filtered.map((r) => r.studentId)).size, rooms: new Set(filtered.map((r) => r.roomNumber)).size };

  const view =
    filters.view === "student"
      ? { view: "student" as const, ...paginate(groupByStudent(filtered), filters.page, PAGE_SIZE.student) }
      : filters.view === "room"
        ? { view: "room" as const, ...paginate(groupByRoom(filtered), filters.page, PAGE_SIZE.room) }
        : { view: "date" as const, ...paginate(sortHistory(filtered), filters.page, PAGE_SIZE.date) };

  return { filters, roomOptions, totals, result: view };
}
