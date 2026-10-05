import { describe, expect, it } from "vitest";
import { isCronAuthorized } from "@/server/lib/cron-auth";
import { istMidnight, planCleanup, retentionCutoffs, type CleanupDataset } from "@/server/lib/retention";
import { studentsWithoutParent, suggestLinks, type LinkCandidate } from "@/server/lib/parent-link";

describe("IST cutoffs (no UTC date bug)", () => {
  it("30-day window = today and the 29 days before it; enquiries 90 days", () => {
    const c = retentionCutoffs(new Date("2026-10-01T10:00:00Z"));
    expect(c.today).toBe("2026-10-01");
    expect(c.checkingKeepFrom).toBe("2026-09-02");
    expect(c.enquiryKeepFrom).toBe("2026-07-04");
  });
  it("11:59:59 PM IST is still the same day; midnight IST starts the next day", () => {
    expect(retentionCutoffs(new Date("2026-09-30T18:29:59Z")).today).toBe("2026-09-30"); // 23:59:59 IST
    expect(retentionCutoffs(new Date("2026-09-30T18:30:00Z")).today).toBe("2026-10-01"); // 00:00:00 IST
  });
  it("a 00:30 IST cron run (19:00 UTC the previous day) already counts as the new IST day", () => {
    const c = retentionCutoffs(new Date("2026-09-30T19:00:00Z"));
    expect(c.today).toBe("2026-10-01");
    expect(c.checkingKeepFrom).toBe("2026-09-02");
  });
  it("IST midnight converts to the correct UTC instant", () => {
    expect(istMidnight("2026-09-02").toISOString()).toBe("2026-09-01T18:30:00.000Z");
  });
  it("month and year boundaries", () => {
    expect(retentionCutoffs(new Date("2027-01-05T10:00:00Z")).checkingKeepFrom).toBe("2026-12-07");
    expect(retentionCutoffs(new Date("2026-03-01T10:00:00Z")).checkingKeepFrom).toBe("2026-01-31");
  });
});

const NOW = new Date("2026-10-01T10:00:00Z");
const ds = (over: Partial<CleanupDataset> = {}): CleanupDataset => ({
  dailyChecks: [], dailyRoomStates: [], acknowledgements: [], deliveryLog: [], enquiries: [], ...over,
});

describe("30-day cleanup boundary", () => {
  it("deletes checks and room states dated before 2 Sep, keeps 2 Sep onwards", () => {
    const p = planCleanup(ds({
      dailyChecks: [{ id: "old", checkDate: "2026-09-01" }, { id: "edge", checkDate: "2026-09-02" }, { id: "today", checkDate: "2026-10-01" }],
      dailyRoomStates: [{ id: "rs-old", checkDate: "2026-09-01" }, { id: "rs-edge", checkDate: "2026-09-02" }],
    }), NOW);
    expect(p.dailyChecks).toEqual(["old"]);
    expect(p.dailyRoomStates).toEqual(["rs-old"]);
  });
  it("acknowledgements and WhatsApp logs: exact IST-midnight instant is kept, 1 ms earlier is deleted", () => {
    const edge = new Date("2026-09-01T18:30:00.000Z"); // 00:00 IST on 2 Sep
    const before = new Date(edge.getTime() - 1);
    const p = planCleanup(ds({
      dailyChecks: [{ id: "c", checkDate: "2026-09-02" }],
      acknowledgements: [{ id: "a-edge", dailyCheckId: "c", acknowledgedAt: edge }, { id: "a-old", dailyCheckId: "c", acknowledgedAt: before }],
      deliveryLog: [{ id: "d-edge", dailyCheckId: "c", openedAt: edge }, { id: "d-old", dailyCheckId: "c", openedAt: before }],
    }), NOW);
    expect(p.acknowledgements).toEqual(["a-old"]);
    expect(p.deliveryLog).toEqual(["d-old"]);
  });
  it("deleting a check cascades to its acknowledgements and logs even if they look recent", () => {
    const p = planCleanup(ds({
      dailyChecks: [{ id: "c-old", checkDate: "2026-08-01" }],
      acknowledgements: [{ id: "a", dailyCheckId: "c-old", acknowledgedAt: new Date("2026-09-30T10:00:00Z") }],
      deliveryLog: [{ id: "d", dailyCheckId: "c-old", openedAt: new Date("2026-09-30T10:00:00Z") }],
    }), NOW);
    expect(p.acknowledgements).toEqual(["a"]);
    expect(p.deliveryLog).toEqual(["d"]);
  });
  it("a record made at 11:30 PM IST on the cutoff day is kept (UTC date would say it is the day before)", () => {
    const p = planCleanup(ds({ dailyChecks: [{ id: "late", checkDate: "2026-09-02" }], acknowledgements: [{ id: "a", dailyCheckId: "late", acknowledgedAt: new Date("2026-09-02T18:00:00Z") }] }), NOW);
    expect(p.dailyChecks).toEqual([]);
    expect(p.acknowledgements).toEqual([]);
  });
});

describe("90-day enquiry boundary", () => {
  it("keeps an enquiry received at 00:00 IST on 4 Jul, deletes one from 23:59:59 IST on 3 Jul", () => {
    const keep = new Date("2026-07-04T00:00:00+05:30");
    const drop = new Date("2026-07-03T23:59:59+05:30");
    const p = planCleanup(ds({ enquiries: [{ id: "keep", createdAt: keep }, { id: "drop", createdAt: drop }, { id: "new", createdAt: new Date("2026-09-30T10:00:00Z") }] }), NOW);
    expect(p.enquiries).toEqual(["drop"]);
  });
  it("30-day data and 90-day enquiries use different windows", () => {
    const p = planCleanup(ds({ enquiries: [{ id: "e60", createdAt: new Date("2026-08-02T10:00:00Z") }], dailyChecks: [{ id: "c60", checkDate: "2026-08-02" }] }), NOW);
    expect(p.enquiries).toEqual([]);
    expect(p.dailyChecks).toEqual(["c60"]);
  });
});

describe("permanent data is outside the cleanup", () => {
  it("the cleanup plan can only ever name the five temporary categories", () => {
    const p = planCleanup(ds(), NOW);
    expect(Object.keys(p).sort()).toEqual(["acknowledgements", "cutoffs", "dailyChecks", "dailyRoomStates", "deliveryLog", "enquiries"]);
  });
});

describe("CRON_SECRET authorisation", () => {
  const secret = "a-long-random-cron-secret-0123456789";
  it("accepts only the exact bearer secret", () => {
    expect(isCronAuthorized(`Bearer ${secret}`, secret)).toBe(true);
    expect(isCronAuthorized(`Bearer ${secret}x`, secret)).toBe(false);
    expect(isCronAuthorized(`Bearer ${secret.slice(0, -1)}`, secret)).toBe(false);
    expect(isCronAuthorized(secret, secret)).toBe(false);
    expect(isCronAuthorized(`bearer ${secret}`, secret)).toBe(false);
    expect(isCronAuthorized("Bearer ", secret)).toBe(false);
    expect(isCronAuthorized(null, secret)).toBe(false);
    expect(isCronAuthorized(undefined, secret)).toBe(false);
  });
  it("fails closed when the secret is not configured or too short", () => {
    expect(isCronAuthorized("Bearer undefined", undefined)).toBe(false);
    expect(isCronAuthorized("Bearer ", "")).toBe(false);
    expect(isCronAuthorized("Bearer short", "short")).toBe(false);
  });
});

describe("parent link suggestions (Warden confirms every link)", () => {
  const s = (id: string, wa: string | null, active = true): LinkCandidate => ({ studentId: id, name: id, roomNumber: "101", parentWhatsapp: wa, isActive: active });
  const all = [s("a", "+919000000101"), s("b", "+919000000101"), s("c", "+919000000102"), s("d", null)];
  it("suggests only unlinked students with the same primary number", () => {
    expect(suggestLinks("+919000000101", all, new Set(["a"])).map((x) => x.studentId)).toEqual(["b"]);
    expect(suggestLinks("+919000000101", all, new Set()).map((x) => x.studentId)).toEqual(["a", "b"]);
    expect(suggestLinks("+919000000999", all, new Set())).toEqual([]);
  });
  it("lists active students nobody can see yet", () => {
    expect(studentsWithoutParent([...all, s("e", "+919000000103", false)], new Set(["a", "c"])).map((x) => x.studentId)).toEqual(["b", "d"]);
  });
});
