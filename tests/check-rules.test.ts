import { describe, expect, it } from "vitest";
import { checkChanged, validateCheckEntry } from "@/server/lib/check-rules";

const v = (raw: Parameters<typeof validateCheckEntry>[0]) => validateCheckEntry(raw);

describe("validateCheckEntry", () => {
  it("Present needs 1-5 stars, note optional", () => {
    expect(v({ studentId: "s", status: "present", stars: 4 }).ok).toBe(true);
    expect(v({ studentId: "s", status: "present" }).ok).toBe(false);
    expect(v({ studentId: "s", status: "present", stars: 0 }).ok).toBe(false);
    expect(v({ studentId: "s", status: "present", stars: 6 }).ok).toBe(false);
    expect(v({ studentId: "s", status: "present", stars: 3.5 }).ok).toBe(false);
  });
  it("Absent has no stars, note optional", () => {
    expect(v({ studentId: "s", status: "absent" }).ok).toBe(true);
    expect(v({ studentId: "s", status: "absent", stars: 3 }).ok).toBe(false);
  });
  it("Other requires a note and no stars", () => {
    expect(v({ studentId: "s", status: "other" }).ok).toBe(false);
    expect(v({ studentId: "s", status: "other", note: "   " }).ok).toBe(false);
    expect(v({ studentId: "s", status: "other", note: "At library" }).ok).toBe(true);
    expect(v({ studentId: "s", status: "other", note: "x", stars: 2 }).ok).toBe(false);
  });
  it("rejects unknown status and trims notes", () => {
    expect(v({ studentId: "s", status: "late" }).ok).toBe(false);
    const r = v({ studentId: "s", status: "absent", note: "  out  " });
    if (r.ok) expect(r.value.note).toBe("out");
  });
});

describe("checkChanged", () => {
  it("detects status, stars and note changes only", () => {
    const base = { status: "present", stars: 4, note: "" };
    expect(checkChanged(base, { studentId: "s", status: "present", stars: 4, note: "" })).toBe(false);
    expect(checkChanged(base, { studentId: "s", status: "present", stars: 5, note: "" })).toBe(true);
    expect(checkChanged(base, { studentId: "s", status: "absent", stars: null, note: "" })).toBe(true);
    expect(checkChanged(base, { studentId: "s", status: "present", stars: 4, note: "new" })).toBe(true);
  });
});
