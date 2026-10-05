import { describe, expect, it } from "vitest";
import {
  filterHistory, groupByRoom, groupByStudent, paginate, parseHistoryParams, sortHistory, type HistoryRow,
} from "@/server/lib/history";
import { classifyQuery, matchRoomPrefix } from "@/server/lib/search";

const NOW = new Date("2026-10-01T10:00:00Z"); // today = 2026-10-01 IST, window starts 2026-09-02

let n = 0;
const row = (over: Partial<HistoryRow>): HistoryRow => ({
  id: `c${n++}`, date: "2026-10-01", studentId: "s1", studentName: "Dummy One", studentCode: "DUMMY-001", studentActive: true,
  roomNumber: "101", status: "present", stars: 4, note: "", roomNote: "", revision: 1, lastEditedAt: null,
  whatsapp: { state: "not_opened", openedAt: null }, ack: { state: "none", at: null }, ...over,
});

describe("history filters + 30-day retention boundary", () => {
  it("defaults to the full retained window: today and the 29 days before", () => {
    const f = parseHistoryParams({}, NOW);
    expect(f.from).toBe("2026-09-02");
    expect(f.to).toBe("2026-10-01");
    expect(f.view).toBe("date");
    expect(f.page).toBe(1);
  });
  it("never reaches before the window, however the URL is edited", () => {
    const f = parseHistoryParams({ from: "2026-01-01", to: "2027-01-01" }, NOW);
    expect(f.from).toBe("2026-09-02");
    expect(f.to).toBe("2026-10-01");
  });
  it("swapped dates are put in order; invalid values fall back to defaults", () => {
    const f = parseHistoryParams({ from: "2026-09-20", to: "2026-09-10" }, NOW);
    expect([f.from, f.to]).toEqual(["2026-09-10", "2026-09-20"]);
    const bad = parseHistoryParams({ from: "2026-02-30", to: "x", status: "late", stars: "9", room: "ab", page: "-3", view: "zzz" }, NOW);
    expect([bad.from, bad.to, bad.status, bad.stars, bad.room, bad.page, bad.view]).toEqual(["2026-09-02", "2026-10-01", null, null, null, 1, "date"]);
  });
  it("IST day boundary: just after midnight IST the window has already moved", () => {
    expect(parseHistoryParams({}, new Date("2026-09-30T18:30:00Z")).to).toBe("2026-10-01");
    expect(parseHistoryParams({}, new Date("2026-09-30T18:29:59Z")).to).toBe("2026-09-30");
  });
  it("rows before the window are excluded, the first retained day is included", () => {
    const f = parseHistoryParams({}, NOW);
    const rows = [row({ date: "2026-09-01" }), row({ date: "2026-09-02" }), row({ date: "2026-10-01" })];
    expect(filterHistory(rows, f).map((r) => r.date).sort()).toEqual(["2026-09-02", "2026-10-01"]);
  });
  it("room, student name/code, status and stars filters combine", () => {
    const rows = [
      row({ studentId: "a", studentName: "Rahul Verma", studentCode: "ST-1", roomNumber: "101", status: "present", stars: 5 }),
      row({ studentId: "b", studentName: "Aman Singh", studentCode: "ST-2", roomNumber: "101", status: "absent", stars: null }),
      row({ studentId: "c", studentName: "Mohit Sharma", studentCode: "ST-3", roomNumber: "102", status: "other", stars: null, note: "library" }),
    ];
    const f = (sp: Record<string, string>) => filterHistory(rows, parseHistoryParams(sp, NOW)).map((r) => r.studentId);
    expect(f({ room: "101" })).toEqual(["a", "b"]);
    expect(f({ q: "aman" })).toEqual(["b"]);
    expect(f({ q: "st-3" })).toEqual(["c"]);
    expect(f({ status: "other" })).toEqual(["c"]);
    expect(f({ stars: "5" })).toEqual(["a"]);
    expect(f({ stars: "none" })).toEqual(["b", "c"]);
    expect(f({ room: "101", status: "present" })).toEqual(["a"]);
    expect(f({ room: "102", status: "present" })).toEqual([]);
  });
  it("shows the room as it was on that day (snapshot), even after a student moved", () => {
    const rows = [row({ date: "2026-10-01", roomNumber: "102" }), row({ date: "2026-09-20", roomNumber: "101" })];
    expect(filterHistory(rows, parseHistoryParams({ room: "101" }, NOW)).map((r) => r.date)).toEqual(["2026-09-20"]);
  });
  it("inactive students' history stays visible (flagged), consistent with the retained window", () => {
    const f = parseHistoryParams({}, NOW);
    const out = filterHistory([row({ studentActive: false, date: "2026-09-10" })], f);
    expect(out).toHaveLength(1);
    expect(out[0]?.studentActive).toBe(false);
  });
});

describe("history views", () => {
  const rows = [
    row({ studentId: "a", studentName: "Rahul", roomNumber: "101", date: "2026-09-30", stars: 4, roomNote: "tidy" }),
    row({ studentId: "a", studentName: "Rahul", roomNumber: "101", date: "2026-10-01", stars: 2 }),
    row({ studentId: "b", studentName: "Aman", roomNumber: "101", date: "2026-10-01", status: "absent", stars: null }),
    row({ studentId: "c", studentName: "Mohit", roomNumber: "102", date: "2026-10-01", stars: 5 }),
  ];
  it("date view: latest first, then room, then name", () => {
    expect(sortHistory(rows).map((r) => `${r.date}|${r.roomNumber}|${r.studentName}`)).toEqual([
      "2026-10-01|101|Aman", "2026-10-01|101|Rahul", "2026-10-01|102|Mohit", "2026-09-30|101|Rahul",
    ]);
  });
  it("student view: one group per student with day counts and the star average (rated Present days only)", () => {
    const g = groupByStudent(rows);
    expect(g.map((x) => x.name)).toEqual(["Aman", "Mohit", "Rahul"]);
    const rahul = g.find((x) => x.studentId === "a");
    expect(rahul?.summary).toEqual({ days: 2, present: 2, absent: 0, other: 0, average: 3, ratedDays: 2 });
    expect(rahul?.rows.map((r) => r.date)).toEqual(["2026-10-01", "2026-09-30"]);
    const aman = g.find((x) => x.studentId === "b");
    expect(aman?.summary.average).toBeNull(); // Absent is not rated
  });
  it("room view: groups by room in order, each day lists its students and the room note once", () => {
    const g = groupByRoom(rows);
    expect(g.map((x) => x.roomNumber)).toEqual(["101", "102"]);
    const r101 = g[0];
    expect(r101?.days.map((d) => d.date)).toEqual(["2026-10-01", "2026-09-30"]);
    expect(r101?.days[1]?.roomNote).toBe("tidy");
    expect(r101?.days[0]?.rows).toHaveLength(2);
  });
  it("paginates safely", () => {
    const items = Array.from({ length: 25 }, (_, i) => i);
    expect(paginate(items, 1, 10).items).toHaveLength(10);
    expect(paginate(items, 3, 10)).toEqual({ items: [20, 21, 22, 23, 24], page: 3, pages: 3, total: 25 });
    expect(paginate(items, 99, 10).page).toBe(3);
    expect(paginate([], 1, 10)).toEqual({ items: [], page: 1, pages: 1, total: 0 });
  });
});

describe("warden search", () => {
  it("digits are a room number first, text is a student name/code", () => {
    expect(classifyQuery("205")).toEqual({ kind: "room", text: "205" });
    expect(classifyQuery(" 20 ")).toEqual({ kind: "room", text: "20" });
    expect(classifyQuery("Rahul")).toEqual({ kind: "name", text: "Rahul" });
    expect(classifyQuery("ST-001")).toEqual({ kind: "name", text: "ST-001" });
    expect(classifyQuery("   ")).toEqual({ kind: "empty" });
    expect(classifyQuery("x".repeat(200)).kind).toBe("name");
  });
  it("exact room first, then rooms starting with the digits, in numeric order", () => {
    const rooms = ["201", "205", "20", "101", "2051"].map((roomNumber) => ({ roomNumber }));
    expect(matchRoomPrefix(rooms, "205").map((r) => r.roomNumber)).toEqual(["205", "2051"]);
    expect(matchRoomPrefix(rooms, "20").map((r) => r.roomNumber)).toEqual(["20", "201", "205", "2051"]);
    expect(matchRoomPrefix(rooms, "9")).toEqual([]);
    expect(matchRoomPrefix(rooms, "2", 2)).toHaveLength(2);
  });
});
