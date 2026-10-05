import { describe, expect, it } from "vitest";
import {
  WHATSAPP_MISSING_REASON,
  buildReportMessage,
  buildWhatsAppLink,
  latestOpen,
  needsWhatsApp,
  whatsappAvailability,
  whatsappState,
} from "@/server/lib/whatsapp";

const base = { date: "2026-10-01", studentName: "Sample Student", roomNumber: "101", note: "Studying" } as const;

describe("buildReportMessage", () => {
  it("Present includes date, student, room, status, stars and note", () => {
    const m = buildReportMessage({ ...base, status: "present", stars: 4 });
    expect(m).toContain("Date: Thursday, 1 October 2026");
    expect(m).toContain("Student: Sample Student");
    expect(m).toContain("Room: 101");
    expect(m).toContain("Status: Present");
    expect(m).toContain("4/5");
    expect(m).toContain("Note: Studying");
  });
  it("Absent/Other never include stars; empty note reads None", () => {
    const a = buildReportMessage({ ...base, status: "absent", stars: null, note: "  " });
    expect(a).toContain("Status: Absent");
    expect(a.includes("Stars")).toBe(false);
    expect(a).toContain("Note: None");
    expect(buildReportMessage({ ...base, status: "other", stars: null, note: "At library" }).includes("Stars")).toBe(false);
  });
});

describe("buildWhatsAppLink", () => {
  it("uses digits only and encodes the text", () => {
    const link = buildWhatsAppLink("+919876500001", "Hi there\nNote: a&b");
    expect(link.startsWith("https://wa.me/919876500001?text=")).toBe(true);
    expect(link).toContain("%0A");
    expect(link).toContain("a%26b");
    expect(link.includes("+")).toBe(false);
  });
});

describe("whatsappAvailability (primary number only)", () => {
  it("missing or malformed numbers are unavailable with a clear reason", () => {
    for (const bad of [null, undefined, "", "98765", "919876500001"]) {
      const r = whatsappAvailability(bad);
      expect(r.available).toBe(false);
      if (!r.available) expect(r.reason).toBe(WHATSAPP_MISSING_REASON);
    }
    const ok = whatsappAvailability("+919876500001");
    expect(ok.available).toBe(true);
  });
});

describe("whatsappState (revision comparison)", () => {
  it("not opened / opened / edited after WhatsApp", () => {
    expect(whatsappState(1, [])).toBe("not_opened");
    expect(whatsappState(1, [1])).toBe("opened");
    expect(whatsappState(2, [1])).toBe("edited_after");
    expect(whatsappState(2, [1, 2])).toBe("opened");
    expect(whatsappState(3, [2, 1])).toBe("edited_after");
  });
  it("a stale click on an old revision cannot hide a newer open", () => {
    expect(whatsappState(2, [2, 1])).toBe("opened");
  });
  it("only available + not-yet-current reports need attention", () => {
    expect(needsWhatsApp("not_opened", true)).toBe(true);
    expect(needsWhatsApp("edited_after", true)).toBe(true);
    expect(needsWhatsApp("opened", true)).toBe(false);
    expect(needsWhatsApp("not_opened", false)).toBe(false);
  });
});

describe("latestOpen", () => {
  it("prefers the highest revision, then the latest click", () => {
    const a = { revision: 1, openedAt: new Date("2026-10-01T10:00:00Z") };
    const b = { revision: 2, openedAt: new Date("2026-10-01T09:00:00Z") };
    const c = { revision: 2, openedAt: new Date("2026-10-01T11:00:00Z") };
    expect(latestOpen([a, b, c])).toEqual(c);
    expect(latestOpen([])).toBeNull();
  });
});
