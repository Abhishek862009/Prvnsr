import { describe, expect, it } from "vitest";
import { parseRoomImportCsv, planRoomImport, type RoomImportSnapshot } from "@/server/lib/room-import-plan";
import { sampleRoomImportCsv } from "@/server/lib/room-import-format";
import { planImport, parseImportCsv } from "@/server/lib/import-plan";
import { sampleImportCsv } from "@/server/lib/import-format";

const snapshot: RoomImportSnapshot = {
  rooms: [
    { id: "a", roomNumber: "101", capacity: 2, isActive: true, activeStudents: 1 },
    { id: "b", roomNumber: "102", capacity: 1, isActive: true, activeStudents: 0 },
    { id: "c", roomNumber: "104", capacity: 2, isActive: true, activeStudents: 2 },
  ],
};
const H = "room_number,capacity,floor\n";
const run = (body: string, mode: "create" | "update" = "create", block = false) =>
  planRoomImport(parseRoomImportCsv(H + body), snapshot, mode, { blockSampleData: block });

describe("rooms import: create mode", () => {
  it("creates new rooms and derives the floor when blank", () => {
    const p = run("201,2,\n202,1,2\n");
    expect(p.canCommit).toBe(true);
    expect(p.rows.map((r) => r.action)).toEqual(["create", "create"]);
    expect(p.rows[0]?.floor).toBe(2);
  });
  it("never overwrites: an existing room number is an error", () => {
    const p = run("101,3,\n");
    expect(p.canCommit).toBe(false);
    expect(p.rows[0]?.errors[0]?.message).toContain("already exists");
  });
  it("rejects bad capacity, bad number, mismatched floor, duplicates in file", () => {
    expect(run("201,0,\n").rows[0]?.errors[0]?.column).toBe("capacity");
    expect(run("201,abc,\n").rows[0]?.errors[0]?.column).toBe("capacity");
    expect(run("201,99,\n").rows[0]?.errors[0]?.column).toBe("capacity");
    expect(run("2A1,2,\n").rows[0]?.errors[0]?.column).toBe("room_number");
    expect(run("201,2,5\n").rows[0]?.errors[0]?.column).toBe("floor");
    const d = run("201,2,\n201,1,\n");
    expect(d.summary.errors).toBe(2);
  });
});

describe("rooms import: update mode", () => {
  it("updates capacity of existing rooms and reports unchanged", () => {
    const p = run("101,3,\n102,1,\n", "update");
    expect(p.rows.map((r) => r.action)).toEqual(["update", "unchanged"]);
    expect(p.canCommit).toBe(true);
  });
  it("unknown rooms are errors (no silent create)", () => {
    const p = run("999,2,\n", "update");
    expect(p.rows[0]?.errors[0]?.message).toContain("does not exist");
  });
  it("cannot drop capacity below active students", () => {
    const p = run("104,1,\n", "update");
    expect(p.rows[0]?.errors[0]?.column).toBe("capacity");
  });
  it("nothing to change is not committable", () => {
    expect(run("102,1,\n", "update").canCommit).toBe(false);
  });
});

describe("file-level and sample-data guards", () => {
  it("rejects missing/unknown columns and empty files", () => {
    expect(parseRoomImportCsv("room_number\n101\n").fileErrors.join(" ")).toContain("capacity");
    expect(parseRoomImportCsv("room_number,capacity,x\n1,1,1\n").fileErrors.join(" ")).toContain('"x"');
    expect(parseRoomImportCsv("").fileErrors.length).toBeGreaterThan(0);
  });
  it("the sample rooms CSV is valid in dev but blocked in production", () => {
    const parsed = parseRoomImportCsv(sampleRoomImportCsv());
    expect(planRoomImport(parsed, snapshot, "create").canCommit).toBe(true);
    const prod = planRoomImport(parsed, snapshot, "create", { blockSampleData: true });
    expect(prod.canCommit).toBe(false);
    expect(prod.summary.errors).toBe(3);
  });
  it("the sample students CSV is blocked in production", () => {
    const parsed = parseImportCsv(sampleImportCsv());
    const snap = { rooms: [{ id: "r", roomNumber: "101", capacity: 5, isActive: true }], students: [] };
    expect(planImport(parsed, snap).canCommit).toBe(true);
    expect(planImport(parsed, snap, { blockSampleData: true }).canCommit).toBe(false);
  });
});
