import { describe, expect, it } from "vitest";
import {
  compareRoomNumbers,
  deriveRoomStatus,
  firstPendingRoom,
  nextPendingRoom,
  summarizeProgress,
  type RoomStatus,
} from "@/server/lib/room-status";

const st = (over: Partial<Parameters<typeof deriveRoomStatus>[0]>) =>
  deriveRoomStatus({ isVacant: false, isManuallyComplete: false, activeStudentIds: ["a", "b"], checkedStudentIds: new Set<string>(), ...over });

describe("deriveRoomStatus", () => {
  it("is pending until every active student is saved", () => {
    expect(st({})).toBe("pending");
    expect(st({ checkedStudentIds: new Set(["a"]) })).toBe("pending");
    expect(st({ checkedStudentIds: new Set(["a", "b"]) })).toBe("complete");
  });
  it("vacant wins, manual complete turns green", () => {
    expect(st({ isVacant: true, checkedStudentIds: new Set(["a", "b"]) })).toBe("vacant");
    expect(st({ isManuallyComplete: true })).toBe("complete");
  });
  it("a room with 0 active students is NOT auto-complete", () => {
    expect(st({ activeStudentIds: [] })).toBe("pending");
    expect(st({ activeStudentIds: [], isManuallyComplete: true })).toBe("complete");
    expect(st({ activeStudentIds: [], isVacant: true })).toBe("vacant");
  });
  it("a newly moved-in unchecked student makes a green room red again", () => {
    expect(st({ activeStudentIds: ["a", "b", "new"], checkedStudentIds: new Set(["a", "b"]) })).toBe("pending");
  });
});

describe("progress and navigation", () => {
  const rooms: { id: string; floor: number; status: RoomStatus }[] = [
    { id: "101", floor: 1, status: "complete" },
    { id: "102", floor: 1, status: "vacant" },
    { id: "103", floor: 1, status: "pending" },
    { id: "201", floor: 2, status: "pending" },
    { id: "202", floor: 2, status: "complete" },
  ];
  it("summarises overall and per floor", () => {
    const s = summarizeProgress(rooms);
    expect(s.overall).toEqual({ total: 5, completed: 2, pending: 2, vacant: 1 });
    expect(s.floors[0]).toEqual({ floor: 1, total: 3, completed: 1, pending: 1, vacant: 1 });
    expect(s.floors[1]).toEqual({ floor: 2, total: 2, completed: 1, pending: 1, vacant: 0 });
  });
  it("finds the first pending room", () => {
    expect(firstPendingRoom(rooms)?.id).toBe("103");
    expect(firstPendingRoom([])).toBeNull();
  });
  it("next room skips complete/vacant and wraps around", () => {
    expect(nextPendingRoom(rooms, "101")?.id).toBe("103");
    expect(nextPendingRoom(rooms, "103")?.id).toBe("201");
    expect(nextPendingRoom(rooms, "201")?.id).toBe("103");
    expect(nextPendingRoom(rooms.map((r) => ({ ...r, status: "complete" as const })), "101")).toBeNull();
  });
  it("sorts room numbers numerically", () => {
    expect(["205", "101", "1001", "102"].sort(compareRoomNumbers)).toEqual(["101", "102", "205", "1001"]);
  });
});
