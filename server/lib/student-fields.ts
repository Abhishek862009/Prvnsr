import { normalizePhone } from "./phone";

export type FieldError = { field: string; message: string };

/** Raw, untrusted input (API body or CSV cell values). */
export type RawStudentFields = {
  studentCode?: string | null;
  name?: string | null;
  parentName?: string | null;
  parentEmail?: string | null;
  parentWhatsapp?: string | null;
  secondaryName?: string | null;
  secondaryEmail?: string | null;
  secondaryWhatsapp?: string | null;
  studentPhone?: string | null;
};

/** Validated + normalised. Phones are E.164, emails lower-case, student code upper-case. */
export type StudentFields = {
  studentCode: string | null;
  name: string;
  parentName: string | null;
  parentEmail: string | null;
  parentWhatsapp: string; // required: it is the Parent Portal login ID
  secondaryName: string | null;
  secondaryEmail: string | null;
  secondaryWhatsapp: string | null;
  studentPhone: string | null;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE = /^[A-Za-z0-9._-]{1,32}$/;

const clean = (v: string | null | undefined): string | null => {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
};

export function validateStudentFields(
  raw: RawStudentFields,
): { ok: true; value: StudentFields } | { ok: false; errors: FieldError[] } {
  const errors: FieldError[] = [];
  const add = (field: string, message: string) => errors.push({ field, message });

  const text = (field: string, v: string | null | undefined, label: string, max: number): string | null => {
    const t = clean(v);
    if (t && t.length > max) add(field, `${label} must be at most ${max} characters.`);
    return t;
  };
  const email = (field: string, v: string | null | undefined, label: string): string | null => {
    const t = clean(v)?.toLowerCase() ?? null;
    if (t && (t.length > 254 || !EMAIL.test(t))) {
      add(field, `${label} is not a valid email address.`);
    }
    return t;
  };
  const phone = (field: string, v: string | null | undefined, label: string): string | null => {
    const t = clean(v);
    if (!t) return null;
    const n = normalizePhone(t);
    if (!n) add(field, `${label} is not a valid phone number.`);
    return n;
  };

  const name = text("name", raw.name, "Name", 100);
  if (!name) add("name", "Name is required.");

  const codeRaw = clean(raw.studentCode);
  let studentCode: string | null = null;
  if (codeRaw) {
    if (!CODE.test(codeRaw)) add("studentCode", "Student code may use letters, numbers, dot, dash, underscore (max 32).");
    else studentCode = codeRaw.toUpperCase();
  }

  const parentWhatsapp = phone("parentWhatsapp", raw.parentWhatsapp, "Parent WhatsApp number");
  if (!clean(raw.parentWhatsapp)) add("parentWhatsapp", "Parent WhatsApp number is required.");

  const value = {
    studentCode,
    name: name ?? "",
    parentName: text("parentName", raw.parentName, "Parent name", 100),
    parentEmail: email("parentEmail", raw.parentEmail, "Parent email"),
    parentWhatsapp: parentWhatsapp ?? "",
    secondaryName: text("secondaryName", raw.secondaryName, "Secondary contact name", 100),
    secondaryEmail: email("secondaryEmail", raw.secondaryEmail, "Secondary contact email"),
    secondaryWhatsapp: phone("secondaryWhatsapp", raw.secondaryWhatsapp, "Secondary contact WhatsApp number"),
    studentPhone: phone("studentPhone", raw.studentPhone, "Student phone"),
  };

  return errors.length ? { ok: false, errors } : { ok: true, value };
}

export const ROOM_NUMBER_PATTERN = /^\d{3,4}$/;

const PATCHABLE = [
  "studentCode", "name", "parentName", "parentEmail", "parentWhatsapp",
  "secondaryName", "secondaryEmail", "secondaryWhatsapp", "studentPhone",
] as const;

/**
 * Edit = current values overlaid with the fields the Warden actually sent.
 *  - field not sent (undefined)  -> unchanged
 *  - null or ""                  -> cleared (optional fields) / rejected by validation (required fields)
 * Only the listed detail fields can ever change: the internal Student ID, room and active flag are not
 * patchable here (room has its own Move flow, so capacity is always checked).
 */
export function mergeStudentPatch(current: RawStudentFields, patch: Record<string, unknown>): RawStudentFields {
  const merged: Record<string, string | null | undefined> = {};
  for (const k of PATCHABLE) merged[k] = (current as Record<string, string | null | undefined>)[k] ?? null;
  for (const k of PATCHABLE) {
    const v = patch[k];
    if (v !== undefined) merged[k] = v === null ? null : String(v);
  }
  return merged as RawStudentFields;
}
