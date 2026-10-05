import { getEnv } from "@/server/config/env";
import { hashToken } from "@/server/auth/tokens";
import { todayInZone } from "@/server/lib/dates";
import { exceedsEnquiryLimit, validateEnquiry, type RawEnquiry } from "@/server/lib/enquiry";
import { DomainError } from "@/server/lib/errors";
import * as enquiriesRepo from "@/server/repos/enquiries";
import type { EnquiryStatus } from "@/server/repos/enquiries";

const HOUR = 3_600_000;

/**
 * Public, write-only. Returns nothing about stored data.
 *  - Honeypot filled  -> pretend success, store nothing (bots learn nothing).
 *  - Per-IP limit     -> 429 (IP is only kept as a keyed hash).
 */
export async function submitEnquiry(raw: RawEnquiry, honeypot: string | null | undefined, ip: string) {
  if (honeypot && honeypot.trim() !== "") return { accepted: true as const };

  const ipHash = hashToken(`enquiry-ip:${ip}`);
  const now = Date.now();
  const [lastHour, lastDay] = await Promise.all([
    enquiriesRepo.countSince(ipHash, new Date(now - HOUR)),
    enquiriesRepo.countSince(ipHash, new Date(now - 24 * HOUR)),
  ]);
  if (exceedsEnquiryLimit({ lastHour, lastDay })) {
    throw new DomainError("rate_limited", "Too many enquiries from your connection. Please try again later or call us.");
  }

  const v = validateEnquiry(raw, todayInZone(getEnv().APP_TIMEZONE));
  if (!v.ok) throw new DomainError("validation", "Please check the highlighted fields.", { errors: v.errors });

  await enquiriesRepo.insertEnquiry({ ...v.value, ipHash });
  return { accepted: true as const };
}

// ---------------- Warden ----------------
export const listEnquiries = (status?: EnquiryStatus) => enquiriesRepo.listEnquiries(status);
export const enquiryCounts = () => enquiriesRepo.countByStatus();

export async function setEnquiryStatus(id: string, status: EnquiryStatus) {
  const row = await enquiriesRepo.updateEnquiryStatus(id, status);
  if (!row) throw new DomainError("not_found", "Enquiry not found.");
  return { id, status };
}

export async function removeEnquiry(id: string) {
  if (!(await enquiriesRepo.deleteEnquiry(id))) throw new DomainError("not_found", "Enquiry not found.");
  return { deleted: true as const };
}
