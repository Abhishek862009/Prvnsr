import { describe, expect, it } from "vitest";
import { ENQUIRY_LIMITS, exceedsEnquiryLimit, validateEnquiry } from "@/server/lib/enquiry";
import { groupRoomsByFloor, sanitizePublicSettings, toPublicRoom, toPublicRooms } from "@/server/lib/public-data";

const today = "2026-10-01";
const good = { name: " Sample Visitor ", phone: "98765 00001", email: "", preferredRoomType: "double", expectedJoiningDate: "2026-11-01", message: "Is a room available?" };

describe("validateEnquiry", () => {
  it("accepts a complete enquiry, email optional, and normalises", () => {
    const r = validateEnquiry(good, today);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.name).toBe("Sample Visitor");
      expect(r.value.phone).toBe("+919876500001");
      expect(r.value.email).toBeNull();
      expect(r.value.preferredRoomType).toBe("double");
    }
  });
  it("lowercases a provided email", () => {
    const r = validateEnquiry({ ...good, email: "A@Example.COM" }, today);
    if (r.ok) expect(r.value.email).toBe("a@example.com");
    expect(r.ok).toBe(true);
  });
  it("requires everything except email", () => {
    const r = validateEnquiry({}, today);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.map((e) => e.field).sort()).toEqual(["expectedJoiningDate", "message", "name", "phone", "preferredRoomType"]);
  });
  it("rejects bad phone, email, room type and dates", () => {
    const bad = (over: object) => validateEnquiry({ ...good, ...over }, today).ok;
    expect(bad({ phone: "123" })).toBe(false);
    expect(bad({ email: "nope" })).toBe(false);
    expect(bad({ preferredRoomType: "suite" })).toBe(false);
    expect(bad({ expectedJoiningDate: "2026-09-30" })).toBe(false); // past
    expect(bad({ expectedJoiningDate: "2026-02-30" })).toBe(false); // not a real date
    expect(bad({ expectedJoiningDate: "2031-01-01" })).toBe(false); // too far ahead
    expect(bad({ expectedJoiningDate: today })).toBe(true); // today is fine
    expect(bad({ message: "x".repeat(1001) })).toBe(false);
  });
});

describe("rate limit", () => {
  it("blocks at the configured per-hour and per-day limits", () => {
    expect(exceedsEnquiryLimit({ lastHour: ENQUIRY_LIMITS.perHour - 1, lastDay: 0 })).toBe(false);
    expect(exceedsEnquiryLimit({ lastHour: ENQUIRY_LIMITS.perHour, lastDay: 0 })).toBe(true);
    expect(exceedsEnquiryLimit({ lastHour: 0, lastDay: ENQUIRY_LIMITS.perDay })).toBe(true);
  });
});

describe("public whitelist", () => {
  it("a public room has exactly roomNumber + status, whatever the source row contains", () => {
    const leaky = { roomNumber: "101", publicAvailability: "full", studentName: "Secret", parentEmail: "p@example.com", capacity: 2, activeStudents: 2 };
    const out = toPublicRoom(leaky);
    expect(Object.keys(out).sort()).toEqual(["roomNumber", "status"]);
    expect(out).toEqual({ roomNumber: "101", status: "full" });
    expect(JSON.stringify(toPublicRooms([leaky])).includes("Secret")).toBe(false);
  });
  it("anything other than 'available' is shown as full", () => {
    expect(toPublicRoom({ roomNumber: "102", publicAvailability: "available" }).status).toBe("available");
    expect(toPublicRoom({ roomNumber: "102", publicAvailability: "weird" }).status).toBe("full");
  });
  it("settings: only valid E.164 numbers pass through", () => {
    expect(sanitizePublicSettings({ callNumber: "+919876500001", whatsappNumber: "9876500001" })).toEqual({ callNumber: "+919876500001", whatsappNumber: null });
    expect(sanitizePublicSettings({})).toEqual({ callNumber: null, whatsappNumber: null });
  });
  it("groups rooms by floor in order", () => {
    const g = groupRoomsByFloor([{ roomNumber: "201", status: "full" }, { roomNumber: "101", status: "available" }, { roomNumber: "102", status: "full" }]);
    expect(g.map((x) => x.floor)).toEqual([1, 2]);
    expect(g[0]?.rooms).toHaveLength(2);
  });
});
