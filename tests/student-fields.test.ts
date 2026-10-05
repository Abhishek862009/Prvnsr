import { describe, expect, it } from "vitest";
import { validateStudentFields } from "@/server/lib/student-fields";

describe("validateStudentFields", () => {
  it("normalises phones, email and student code", () => {
    const r = validateStudentFields({
      studentCode: " st-001 ",
      name: "  Sample Student ",
      parentEmail: "Parent@Example.COM",
      parentWhatsapp: "98765 00001",
      secondaryWhatsapp: "+91 98765 00002",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.studentCode).toBe("ST-001");
      expect(r.value.name).toBe("Sample Student");
      expect(r.value.parentEmail).toBe("parent@example.com");
      expect(r.value.parentWhatsapp).toBe("+919876500001");
      expect(r.value.secondaryWhatsapp).toBe("+919876500002");
      expect(r.value.studentPhone).toBeNull();
    }
  });
  it("requires name and parent WhatsApp", () => {
    const r = validateStudentFields({});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.map((e) => e.field).sort()).toEqual(["name", "parentWhatsapp"]);
  });
  it("rejects bad email, phone and code", () => {
    const r = validateStudentFields({
      studentCode: "no spaces!",
      name: "A",
      parentEmail: "nope",
      parentWhatsapp: "123",
      studentPhone: "abc",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.map((e) => e.field).sort()).toEqual(["parentEmail", "parentWhatsapp", "studentCode", "studentPhone"]);
  });
});
