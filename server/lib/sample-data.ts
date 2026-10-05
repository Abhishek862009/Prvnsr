import type { StudentFields } from "./student-fields";

/** Room numbers used only by the downloadable sample rooms CSV. */
export const SAMPLE_ROOM_NUMBERS = ["9001", "9002", "9003"] as const;

export const isSampleRoomNumber = (roomNumber: string) => (SAMPLE_ROOM_NUMBERS as readonly string[]).includes(roomNumber);

const SAMPLE_DOMAIN = /@example\.(com|org|net)$/i;

/** True for rows that come from the sample CSV or the dummy seed. Blocked in production. */
export function looksLikeSampleStudent(f: StudentFields): boolean {
  if (f.studentCode && /^(SAMPLE|DUMMY)-/.test(f.studentCode)) return true;
  if (/^sample\s/i.test(f.name)) return true;
  return [f.parentEmail, f.secondaryEmail].some((e) => !!e && SAMPLE_DOMAIN.test(e));
}
