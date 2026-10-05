import { describe, expect, it } from "vitest";
import { parseImportCsv, planImport, type ImportSnapshot } from "@/server/lib/import-plan";
import { sampleImportCsv } from "@/server/lib/import-format";

const snapshot: ImportSnapshot = {
  rooms: [
    { id: "r101", roomNumber: "101", capacity: 2, isActive: true },
    { id: "r102", roomNumber: "102", capacity: 1, isActive: true },
    { id: "r103", roomNumber: "103", capacity: 2, isActive: false },
  ],
  students: [
    { id: "s1", studentCode: "ST-1", name: "Existing One", roomId: "r101", isActive: true, parentWhatsapp: "+919876500001" },
  ],
};

const HEADER = "student_code,name,room_number,parent_whatsapp\n";
const plan = (body: string) => planImport(parseImportCsv(HEADER + body), snapshot);

describe("planImport", () => {
  it("the downloadable sample is itself a valid file", () => {
    const p = planImport(parseImportCsv(sampleImportCsv()), { ...snapshot, students: [] });
    expect(p.fileErrors).toEqual([]);
    expect(p.canCommit).toBe(true);
    expect(p.summary.create).toBe(2);
  });

  it("creates when there is no code, updates when the code matches", () => {
    const p = plan("ST-1,Existing One Renamed,101,98765 00001\n,New Kid,102,98765 00009\n");
    expect(p.rows.map((r) => r.action)).toEqual(["update", "create"]);
    expect(p.canCommit).toBe(true);
  });

  it("a new code creates a new student", () => {
    const p = plan("ST-9,New Coded,102,98765 00009\n");
    expect(p.rows[0]?.action).toBe("create");
  });

  it("reports unknown and inactive rooms and bad fields", () => {
    const p = plan(",A,999,98765 00002\n,B,103,98765 00003\n,C,101,123\n");
    expect(p.canCommit).toBe(false);
    expect(p.summary.errors).toBe(3);
    expect(p.rows[0]?.errors[0]?.column).toBe("room_number");
    expect(p.rows[2]?.errors[0]?.column).toBe("parent_whatsapp");
  });

  it("flags duplicate student codes in the file", () => {
    const p = plan("ST-5,A,102,98765 00002\nst-5,B,101,98765 00003\n");
    expect(p.rows.every((r) => r.action === "error")).toBe(true);
  });

  it("flags identical code-less rows instead of importing them twice", () => {
    const p = plan(",Twin,101,98765 00002\n,twin,101,98765 00002\n");
    expect(p.summary.errors).toBe(2);
  });

  it("does not silently duplicate an existing student when the code is missing", () => {
    const p = plan(",Existing One,101,98765 00001\n");
    expect(p.rows[0]?.action).toBe("error");
    expect(p.rows[0]?.errors[0]?.message).toContain("student_code");
  });

  it("rejects rows that would exceed room capacity", () => {
    const p = plan(",A,101,98765 00002\n,B,101,98765 00003\n");
    expect(p.summary.errors).toBe(2);
    expect(p.rows[0]?.errors[0]?.message).toContain("holds 2");
  });

  it("allows a swap-style move that keeps capacity balanced", () => {
    const p = plan("ST-1,Existing One,102,98765 00001\n");
    expect(p.rows[0]?.action).toBe("update");
    expect(p.canCommit).toBe(true);
  });

  it("rejects file-level problems before any row work", () => {
    expect(parseImportCsv("name,room_number\nX,101\n").fileErrors.join(" ")).toContain("parent_whatsapp");
    expect(parseImportCsv("name,room_number,parent_whatsapp,bogus\nX,101,1,2\n").fileErrors.join(" ")).toContain("bogus");
    expect(parseImportCsv("").fileErrors.length).toBeGreaterThan(0);
    expect(planImport(parseImportCsv("name,room_number,parent_whatsapp\n"), snapshot).canCommit).toBe(false);
  });
});
