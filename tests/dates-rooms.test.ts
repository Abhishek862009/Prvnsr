import { describe, expect, it } from "vitest";
import { addDays, dateInZone } from "@/server/lib/dates";
import { deriveFloor } from "@/server/lib/rooms";

describe("dateInZone (IST)", () => {
  it("keeps 11 PM IST on the same IST day (UTC is 17:30, same day)", () => {
    expect(dateInZone(new Date("2026-09-30T17:30:00Z"))).toBe("2026-09-30");
  });
  it("rolls to next IST day after midnight IST even though UTC is still the previous day", () => {
    expect(dateInZone(new Date("2026-09-30T18:45:00Z"))).toBe("2026-10-01");
  });
});

describe("addDays", () => {
  it("does calendar arithmetic across month boundaries", () => {
    expect(addDays("2026-10-01", -29)).toBe("2026-09-02");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("deriveFloor", () => {
  it("derives floor from room number", () => {
    expect(deriveFloor("101")).toBe(1);
    expect(deriveFloor("205")).toBe(2);
    expect(deriveFloor("1012")).toBe(10);
    expect(deriveFloor("A1")).toBeNull();
  });
});
