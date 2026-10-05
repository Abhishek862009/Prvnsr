import { addDays } from "./dates";
import { normalizePhone } from "./phone";
import type { FieldError } from "./student-fields";

export const ROOM_TYPES = ["single", "double", "any"] as const;
export type RoomType = (typeof ROOM_TYPES)[number];
export const ROOM_TYPE_LABEL: Record<RoomType, string> = {
  single: "Single room",
  double: "Double room",
  any: "No preference",
};

export type RawEnquiry = {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  preferredRoomType?: string | null;
  expectedJoiningDate?: string | null;
  message?: string | null;
};

export type EnquiryFields = {
  name: string;
  phone: string; // E.164
  email: string | null;
  preferredRoomType: RoomType;
  expectedJoiningDate: string; // YYYY-MM-DD
  message: string;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_MONTHS_AHEAD_DAYS = 730;

/** Only Email is optional. Pure: `today` (IST date) is passed in. */
export function validateEnquiry(
  raw: RawEnquiry,
  today: string,
): { ok: true; value: EnquiryFields } | { ok: false; errors: FieldError[] } {
  const errors: FieldError[] = [];
  const add = (field: string, message: string) => errors.push({ field, message });
  const clean = (v: string | null | undefined) => (v ?? "").trim();

  const name = clean(raw.name);
  if (!name) add("name", "Please enter your name.");
  else if (name.length > 100) add("name", "Name must be at most 100 characters.");

  const phoneRaw = clean(raw.phone);
  const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
  if (!phoneRaw) add("phone", "Please enter your phone number.");
  else if (!phone) add("phone", "Please enter a valid phone number.");

  const emailRaw = clean(raw.email).toLowerCase();
  if (emailRaw && (emailRaw.length > 254 || !EMAIL.test(emailRaw))) add("email", "Please enter a valid email address or leave it blank.");

  const type = clean(raw.preferredRoomType);
  if (!(ROOM_TYPES as readonly string[]).includes(type)) add("preferredRoomType", "Please choose a room type.");

  const date = clean(raw.expectedJoiningDate);
  if (!date) add("expectedJoiningDate", "Please choose your expected joining date.");
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || addDays(date, 0) !== date) add("expectedJoiningDate", "Please enter a valid date.");
  else if (date < today) add("expectedJoiningDate", "Joining date cannot be in the past.");
  else if (date > addDays(today, MAX_MONTHS_AHEAD_DAYS)) add("expectedJoiningDate", "Joining date is too far ahead.");

  const message = clean(raw.message);
  if (!message) add("message", "Please write a short message.");
  else if (message.length > 1000) add("message", "Message must be at most 1000 characters.");

  if (errors.length || !phone) return { ok: false, errors };
  return {
    ok: true,
    value: { name, phone, email: emailRaw || null, preferredRoomType: type as RoomType, expectedJoiningDate: date, message },
  };
}

/** Per-IP limits for the public form (no CAPTCHA). */
export const ENQUIRY_LIMITS = { perHour: 3, perDay: 10 } as const;

export const exceedsEnquiryLimit = (c: { lastHour: number; lastDay: number }): boolean =>
  c.lastHour >= ENQUIRY_LIMITS.perHour || c.lastDay >= ENQUIRY_LIMITS.perDay;
