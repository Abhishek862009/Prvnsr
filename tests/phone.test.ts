import { describe, expect, it } from "vitest";
import { normalizePhone, toWhatsAppDigits } from "@/server/lib/phone";

describe("normalizePhone", () => {
  it("formats Indian numbers to E.164", () => {
    expect(normalizePhone("98765 43210")).toBe("+919876543210");
    expect(normalizePhone("09876543210")).toBe("+919876543210");
    expect(normalizePhone("919876543210")).toBe("+919876543210");
    expect(normalizePhone("+91-98765-43210")).toBe("+919876543210");
  });
  it("accepts international numbers with + or 00", () => {
    expect(normalizePhone("+44 7911 123456")).toBe("+447911123456");
    expect(normalizePhone("0044 7911 123456")).toBe("+447911123456");
  });
  it("rejects invalid numbers", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("5876543210")).toBeNull(); // Indian mobiles start 6-9
    expect(normalizePhone("abcdefghij")).toBeNull();
  });
  it("produces wa.me digits", () => {
    expect(toWhatsAppDigits("+919876543210")).toBe("919876543210");
  });
});
