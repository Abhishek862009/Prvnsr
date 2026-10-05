import { getEnv } from "@/server/config/env";
import { todayInZone } from "@/server/lib/dates";
import { DomainError } from "@/server/lib/errors";
import {
  ackState,
  buildTrend,
  isReportDateAccessible,
  rangeBounds,
  starSummary,
  type AckState,
  type HistoryRange,
} from "@/server/lib/parent-report";
import { listLinkedStudents } from "@/server/repos/parents";
import * as reportsRepo from "@/server/repos/parent-reports";
import { resolveStudentAccess, type StudentAccess } from "./student-access";

const today = () => todayInZone(getEnv().APP_TIMEZONE);

/**
 * EVERY function below starts from resolveStudentAccess(parentId, studentId): it returns null
 * unless this parent is linked to the student, and the answer is a 404 (never a hint that the
 * student exists). Student IDs from the browser are never trusted on their own.
 */
async function accessOrThrow(parentId: string, studentId: string): Promise<StudentAccess> {
  const access = await resolveStudentAccess(parentId, studentId);
  if (!access) throw new DomainError("not_found", "Not found.");
  return access;
}

export type ParentReport = {
  id: string;
  date: string;
  roomNumber: string;
  status: "present" | "absent" | "other";
  stars: number | null;
  note: string;
  roomNote: string;
  revision: number;
  editedAt: Date | null;
  ack: { state: AckState; at: Date | null };
};

async function loadReports(parentId: string, access: StudentAccess, range: HistoryRange): Promise<ParentReport[]> {
  const t = today();
  const { from, to } = rangeBounds(range, access, t);
  const rows = await reportsRepo.listStudentReports({ parentId, studentId: access.studentId, from, to });
  return rows
    .filter((r) => isReportDateAccessible(access, r.date, t))
    .map((r) => {
      const state = ackState(r.revision, r.ackRevision);
      return {
        id: r.id,
        date: r.date,
        roomNumber: r.roomNumber,
        status: r.status,
        stars: r.stars,
        note: r.note,
        roomNote: r.roomNote ?? "",
        revision: r.revision,
        editedAt: r.lastEditedAt,
        ack: { state, at: state === "none" ? null : r.acknowledgedAt },
      };
    });
}

/**
 * Student selector: only the parent's OWN linked students are candidates. An unknown or foreign
 * id in the URL silently falls back to the first linked student, so nothing is revealed.
 */
export async function selectStudent(parentId: string, requestedStudentId?: string) {
  const students = await listLinkedStudents(parentId);
  const selected = students.find((s) => s.studentId === requestedStudentId) ?? students[0] ?? null;
  return { students, selected };
}

// ---------------- Dashboard ----------------
export async function getPortalOverview(parentId: string, requestedStudentId?: string) {
  const { students: linked, selected } = await selectStudent(parentId, requestedStudentId);
  if (!selected) return { students: linked, selected: null };

  const access = await accessOrThrow(parentId, selected.studentId);
  const t = today();
  const reports = await loadReports(parentId, access, "all");
  return {
    students: linked,
    selected,
    date: t,
    isActive: access.isActive,
    /** Today's report. Always null for an inactive student (current reports are closed). */
    today: access.currentReportsAllowed ? (reports.find((r) => r.date === t) ?? null) : null,
    /** Dynamic: calculated from the retained reports every time, never stored. */
    stars: starSummary(reports),
    /** Reports the parent has not acknowledged yet, or that were edited after they did. */
    awaitingAck: reports.filter((r) => r.ack.state !== "acknowledged").length,
  };
}

// ---------------- History & stars ----------------
export async function getStudentHistory(parentId: string, studentId: string, range: HistoryRange) {
  const access = await accessOrThrow(parentId, studentId);
  const reports = await loadReports(parentId, access, range);
  return { range, isActive: access.isActive, reports, stars: starSummary(reports) };
}

export async function getStudentStars(parentId: string, studentId: string, range: HistoryRange) {
  const access = await accessOrThrow(parentId, studentId);
  const reports = await loadReports(parentId, access, range);
  const t = today();
  const { from, to } = rangeBounds(range, access, t);
  // Never chart days beyond today, or (for an inactive student) beyond the allowed window.
  const trendTo = to !== null && to < t ? to : t;
  const trendFrom = from > trendTo ? trendTo : from;
  return {
    range,
    isActive: access.isActive,
    reports,
    stars: starSummary(reports),
    trend: buildTrend(reports, trendFrom, trendTo),
  };
}

// ---------------- Acknowledge / Seen ----------------
/**
 * The parent acknowledges a specific revision of a report. If the Warden edited it since the
 * parent loaded the page, the request is refused so nobody "acknowledges" text they never saw.
 */
export async function acknowledgeReport(parentId: string, checkId: string, revision: number) {
  const check = await reportsRepo.findCheckById(checkId);
  // Same 404 whether the report does not exist or belongs to someone else's child.
  if (!check) throw new DomainError("not_found", "Not found.");
  const access = await accessOrThrow(parentId, check.studentId);
  if (!isReportDateAccessible(access, check.date, today())) throw new DomainError("not_found", "Not found.");

  if (check.revision !== revision) {
    throw new DomainError("conflict", "This report was updated. Please review it and acknowledge again.", { code: "report_updated" });
  }
  const at = await reportsRepo.upsertAcknowledgement({ dailyCheckId: check.id, parentId, revision: check.revision });
  return { state: "acknowledged" as const, at };
}
