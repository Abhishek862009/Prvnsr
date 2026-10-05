import { describe, expect, it } from "vitest";
import {
  ackState,
  buildTrend,
  isReportDateAccessible,
  parseRange,
  rangeBounds,
  starSummary,
  summarizeAcks,
} from "@/server/lib/parent-report";

describe("ackState (revision comparison)", () => {
  it("none / acknowledged / updated", () => {
    expect(ackState(1, null)).toBe("none");
    expect(ackState(1, undefined)).toBe("none");
    expect(ackState(1, 1)).toBe("acknowledged");
    expect(ackState(2, 1)).toBe("updated"); // edited after the parent saw it
    expect(ackState(2, 2)).toBe("acknowledged");
  });
});

describe("summarizeAcks (warden view)", () => {
  const t1 = new Date("2026-10-01T10:00:00Z");
  const t2 = new Date("2026-10-01T12:00:00Z");
  it("reports latest acknowledgement of the current revision", () => {
    expect(summarizeAcks(2, [])).toEqual({ state: "none", at: null });
    expect(summarizeAcks(2, [{ revision: 1, acknowledgedAt: t1 }])).toEqual({ state: "updated", at: t1 });
    expect(summarizeAcks(2, [{ revision: 1, acknowledgedAt: t1 }, { revision: 2, acknowledgedAt: t2 }])).toEqual({ state: "acknowledged", at: t2 });
  });
});

describe("starSummary", () => {
  it("averages only rated Present days, rounded to 1 decimal", () => {
    const s = starSummary([
      { status: "present", stars: 5 },
      { status: "present", stars: 4 },
      { status: "present", stars: 4 },
      { status: "absent", stars: null },
      { status: "other", stars: null },
    ]);
    expect(s).toEqual({ average: 4.3, ratedDays: 3 });
  });
  it("is null when nothing is rated", () => {
    expect(starSummary([{ status: "absent", stars: null }])).toEqual({ average: null, ratedDays: 0 });
    expect(starSummary([])).toEqual({ average: null, ratedDays: 0 });
  });
});

describe("buildTrend", () => {
  it("fills every day, null for unrated", () => {
    const t = buildTrend(
      [
        { date: "2026-10-01", status: "present", stars: 4 },
        { date: "2026-10-03", status: "absent", stars: null },
      ],
      "2026-09-30",
      "2026-10-03",
    );
    expect(t.map((p) => p.stars)).toEqual([null, 4, null, null]);
    expect(t).toHaveLength(4);
  });
});

describe("history window", () => {
  const active = { currentReportsAllowed: true, historyFrom: "2026-09-02", historyTo: null };
  const inactive = { currentReportsAllowed: false, historyFrom: "2026-09-02", historyTo: "2026-09-25" };
  const today = "2026-10-01";

  it("range filters never exceed the access window", () => {
    expect(rangeBounds("7", active, today)).toEqual({ from: "2026-09-25", to: null });
    expect(rangeBounds("30", active, today)).toEqual({ from: "2026-09-02", to: null });
    expect(rangeBounds("all", active, today)).toEqual({ from: "2026-09-02", to: null });
    expect(rangeBounds("7", inactive, today)).toEqual({ from: "2026-09-25", to: "2026-09-25" });
  });
  it("parseRange falls back to 30", () => {
    expect(parseRange("7")).toBe("7");
    expect(parseRange("all")).toBe("all");
    expect(parseRange("bogus")).toBe("30");
    expect(parseRange(null)).toBe("30");
  });
  it("active student: retained history only", () => {
    expect(isReportDateAccessible(active, "2026-10-01", today)).toBe(true);
    expect(isReportDateAccessible(active, "2026-09-01", today)).toBe(false);
  });
  it("inactive student: history up to deactivation, never current or later", () => {
    expect(isReportDateAccessible(inactive, "2026-09-20", today)).toBe(true);
    expect(isReportDateAccessible(inactive, "2026-09-26", today)).toBe(false);
    expect(isReportDateAccessible(inactive, "2026-10-01", today)).toBe(false);
    expect(isReportDateAccessible({ ...inactive, historyTo: "2026-10-01" }, "2026-10-01", today)).toBe(false); // deactivated today: today's is still "current"
  });
});
