import { getEnv } from "@/server/config/env";
import { todayInZone } from "@/server/lib/dates";
import { DomainError } from "@/server/lib/errors";
import { compareRoomNumbers } from "@/server/lib/room-status";
import {
  buildReportMessage,
  buildWhatsAppLink,
  latestOpen,
  needsWhatsApp,
  whatsappAvailability,
  whatsappState,
  type WhatsAppState,
} from "@/server/lib/whatsapp";
import * as reportsRepo from "@/server/repos/reports";

const today = () => todayInZone(getEnv().APP_TIMEZONE);

export type ReportFilter = "all" | "needs_whatsapp";

export type TodayReportRow = {
  checkId: string;
  roomNumber: string;
  studentName: string;
  status: "present" | "absent" | "other";
  stars: number | null;
  note: string;
  revision: number;
  editedAt: Date | null;
  whatsapp: {
    state: WhatsAppState;
    openedAt: Date | null;
    /** Primary parent number present and valid. */
    available: boolean;
    reason: string | null;
    /** wa.me link with the CURRENT report pre-filled. Null when unavailable. */
    url: string | null;
  };
};

/**
 * Today's Reports: a checklist of today's saved checks so the Warden can spot parents he has not
 * contacted yet. It is NOT a bulk sender - every WhatsApp message is opened and sent by hand.
 */
export async function getTodaysReports(filter: ReportFilter = "all") {
  const date = today();
  const checks = await reportsRepo.listChecksForDate(date);
  const opens = await reportsRepo.listWhatsappOpens(checks.map((c) => c.id));

  const all: TodayReportRow[] = checks.map((c) => {
    const mine = opens.filter((o) => o.dailyCheckId === c.id);
    const last = latestOpen(mine);
    const avail = whatsappAvailability(c.parentWhatsapp);
    const message = buildReportMessage({
      date,
      studentName: c.studentName,
      roomNumber: c.roomNumber,
      status: c.status,
      stars: c.stars,
      note: c.note,
    });
    return {
      checkId: c.id,
      roomNumber: c.roomNumber,
      studentName: c.studentName,
      status: c.status,
      stars: c.stars,
      note: c.note,
      revision: c.revision,
      editedAt: c.lastEditedAt,
      whatsapp: {
        state: whatsappState(c.revision, mine.map((o) => o.revision)),
        openedAt: last?.openedAt ?? null,
        available: avail.available,
        reason: avail.available ? null : avail.reason,
        url: avail.available ? buildWhatsAppLink(avail.e164, message) : null,
      },
    };
  });

  all.sort((a, b) => compareRoomNumbers(a.roomNumber, b.roomNumber) || a.studentName.localeCompare(b.studentName));

  const summary = {
    total: all.length,
    opened: all.filter((r) => r.whatsapp.state === "opened").length,
    notOpened: all.filter((r) => r.whatsapp.state === "not_opened").length,
    editedAfter: all.filter((r) => r.whatsapp.state === "edited_after").length,
    noNumber: all.filter((r) => !r.whatsapp.available).length,
    /** Available numbers whose current report has not been opened in WhatsApp yet. */
    needsWhatsApp: all.filter((r) => needsWhatsApp(r.whatsapp.state, r.whatsapp.available)).length,
  };
  const rows = filter === "needs_whatsapp" ? all.filter((r) => needsWhatsApp(r.whatsapp.state, r.whatsapp.available)) : all;
  return { date, filter, summary, rows };
}

/**
 * Called when the Warden taps the WhatsApp button. Records WHICH revision of the report was
 * opened (the one embedded in the link he tapped) and when. This is only "opened": the system
 * cannot know whether the Warden pressed Send, or whether anything was delivered or read.
 */
export async function recordWhatsappOpened(checkId: string, revision: number) {
  const check = await reportsRepo.findCheckForDelivery(checkId);
  if (!check) throw new DomainError("not_found", "Report not found.");
  if (check.date !== today()) throw new DomainError("validation", "Only today's reports can be opened from this page.");
  if (!Number.isInteger(revision) || revision < 1 || revision > check.revision) {
    throw new DomainError("validation", "Invalid report revision.");
  }
  const row = await reportsRepo.insertWhatsappOpen({ dailyCheckId: check.id, revision });
  return { state: whatsappState(check.revision, [revision]), openedAt: row?.openedAt ?? null };
}
