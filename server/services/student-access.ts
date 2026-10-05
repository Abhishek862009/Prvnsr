import { CHECKING_HISTORY_DAYS } from "@/server/config/retention";
import { getEnv } from "@/server/config/env";
import { addDays, dateInZone, todayInZone } from "@/server/lib/dates";
import { findLinkedStudent } from "@/server/repos/parents";

export type StudentAccess = {
  studentId: string;
  isActive: boolean;
  /** False once the student is inactive: current/new reports are hidden. */
  currentReportsAllowed: boolean;
  /** Inclusive YYYY-MM-DD window the parent may read history for. */
  historyFrom: string;
  historyTo: string | null; // null = no upper limit (active student)
};

/**
 * The single place that decides what a parent may see of a student.
 * Returns null when the parent is not linked (callers must respond 404, not 403,
 * so the existence of other students is never revealed).
 */
export async function resolveStudentAccess(parentId: string, studentId: string): Promise<StudentAccess | null> {
  const row = await findLinkedStudent(parentId, studentId);
  if (!row) return null;

  const tz = getEnv().APP_TIMEZONE;
  const historyFrom = addDays(todayInZone(tz), -(CHECKING_HISTORY_DAYS - 1));
  const historyTo = row.isActive ? null : dateInZone(row.deactivatedAt ?? new Date(), tz);

  return {
    studentId: row.studentId,
    isActive: row.isActive,
    currentReportsAllowed: row.isActive,
    historyFrom,
    historyTo,
  };
}
