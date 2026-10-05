/**
 * Normalises a phone number to E.164 (e.g. "+919876543210"), or returns null if invalid.
 * Default country is India (+91); other countries are accepted when entered with "+" or "00".
 */
export function normalizePhone(input: string, defaultCountryCode = "91"): string | null {
  const raw = input.trim();
  if (!raw) return null;

  const cleaned = raw.replace(/[^\d+]/g, "");
  let e164: string;

  if (cleaned.startsWith("+")) {
    e164 = "+" + cleaned.replace(/\D/g, "");
  } else if (cleaned.startsWith("00")) {
    e164 = "+" + cleaned.slice(2).replace(/\D/g, "");
  } else {
    const d = cleaned.replace(/\D/g, "");
    if (d.length === 10) e164 = `+${defaultCountryCode}${d}`;
    else if (d.length === 11 && d.startsWith("0")) e164 = `+${defaultCountryCode}${d.slice(1)}`;
    else if (d.startsWith(defaultCountryCode) && d.length === defaultCountryCode.length + 10) e164 = `+${d}`;
    else return null;
  }

  if (!/^\+[1-9]\d{7,14}$/.test(e164)) return null;
  if (e164.startsWith("+91") && !/^\+91[6-9]\d{9}$/.test(e164)) return null;
  return e164;
}

/** wa.me expects digits only, without "+". */
export function toWhatsAppDigits(e164: string): string {
  return e164.replace(/^\+/, "");
}
