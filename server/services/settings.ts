import { DomainError } from "@/server/lib/errors";
import { normalizePhone } from "@/server/lib/phone";
import { sanitizePublicSettings, type PublicSettings } from "@/server/lib/public-data";
import * as settingsRepo from "@/server/repos/settings";

const KEY_CALL = "public_call_number";
const KEY_WHATSAPP = "public_whatsapp_number";

/** Numbers the public website uses. Editable by the Warden; null = not set (buttons are hidden). */
export async function getPublicSettings(): Promise<PublicSettings> {
  const s = await settingsRepo.getSettings([KEY_CALL, KEY_WHATSAPP]);
  return sanitizePublicSettings({ callNumber: s[KEY_CALL], whatsappNumber: s[KEY_WHATSAPP] });
}

/** The public site must still render if the database is briefly unavailable. */
export async function getPublicSettingsSafe(): Promise<PublicSettings> {
  try {
    return await getPublicSettings();
  } catch {
    return { callNumber: null, whatsappNumber: null };
  }
}

async function apply(key: string, input: string | null | undefined, label: string) {
  if (input === undefined) return; // not provided: unchanged
  const trimmed = (input ?? "").trim();
  if (trimmed === "") {
    await settingsRepo.deleteSetting(key);
    return;
  }
  const e164 = normalizePhone(trimmed);
  if (!e164) throw new DomainError("validation", `${label} is not a valid phone number.`);
  await settingsRepo.upsertSetting(key, e164);
}

export async function updatePublicSettings(input: { callNumber?: string | null; whatsappNumber?: string | null }) {
  // Validate both before writing either, so a bad value never leaves a half-applied change.
  for (const [value, label] of [[input.callNumber, "Call number"], [input.whatsappNumber, "WhatsApp number"]] as const) {
    if (value && value.trim() && !normalizePhone(value.trim())) throw new DomainError("validation", `${label} is not a valid phone number.`);
  }
  await apply(KEY_CALL, input.callNumber, "Call number");
  await apply(KEY_WHATSAPP, input.whatsappNumber, "WhatsApp number");
  return getPublicSettings();
}
