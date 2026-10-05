import { describe, expect, it } from "vitest";
import { floorLayouts } from "@/layouts/index";
import { validateLayout } from "@/server/lib/layout-validation";

describe("shipped dummy layouts", () => {
  it("are structurally valid and match the dummy rooms", () => {
    const dummy: Record<number, string[]> = {
      1: ["101", "102", "103", "104", "105"],
      2: ["201", "202", "203", "204", "205"],
    };
    for (const layout of floorLayouts) {
      const issues = validateLayout(layout, dummy[layout.floor] ?? []);
      expect(issues.errors).toEqual([]);
      expect(issues.warnings).toEqual([]);
    }
  });
});

describe("validateLayout", () => {
  const base = { floor: 1, width: 100, height: 100, corridors: [], walls: [], features: [] };
  it("flags overlaps, outside-canvas, wrong floor and duplicates", () => {
    const l = {
      ...base,
      rooms: [
        { roomNumber: "101", x: 0, y: 0, w: 60, h: 60 },
        { roomNumber: "102", x: 50, y: 50, w: 60, h: 60 },
        { roomNumber: "201", x: 0, y: 0, w: 5, h: 5 },
        { roomNumber: "101", x: 70, y: 0, w: 10, h: 10 },
      ],
    };
    const e = validateLayout(l, []).errors.join(" | ");
    expect(e).toContain("overlap");
    expect(e).toContain("outside the canvas");
    expect(e).toContain("floor 1");
    expect(e).toContain("twice");
  });
  it("warns about database/layout mismatches without failing", () => {
    const l = { ...base, rooms: [{ roomNumber: "101", x: 0, y: 0, w: 10, h: 10 }] };
    const r = validateLayout(l, ["101", "102"]);
    expect(r.errors).toEqual([]);
    expect(r.warnings.join(" ")).toContain("102");
  });
});
