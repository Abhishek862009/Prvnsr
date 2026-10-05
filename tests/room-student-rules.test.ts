import { describe, expect, it } from "vitest";
import {
  MAX_ROOM_CAPACITY, decideMove, decideRoomChange, roomSpaceDecision, validateCapacityInput, validateRoomNumberInput,
} from "@/server/lib/rooms";
import { mergeStudentPatch, validateStudentFields } from "@/server/lib/student-fields";

describe("room validation (add / edit room)", () => {
  it("accepts 3-4 digit numbers and derives the floor", () => {
    expect(validateRoomNumberInput("101")).toEqual({ ok: true, roomNumber: "101", floor: 1 });
    expect(validateRoomNumberInput("  205 ")).toEqual({ ok: true, roomNumber: "205", floor: 2 });
    expect(validateRoomNumberInput("1012")).toEqual({ ok: true, roomNumber: "1012", floor: 10 });
  });
  it("rejects anything else (so the floor can never disagree with the number)", () => {
    for (const bad of ["", "12", "A101", "10 1", "12345", "1.5", "-101"]) expect(validateRoomNumberInput(bad).ok).toBe(false);
  });
  it("capacity must be a whole number from 1 to the maximum", () => {
    expect(validateCapacityInput(1).ok).toBe(true);
    expect(validateCapacityInput(MAX_ROOM_CAPACITY).ok).toBe(true);
    for (const bad of [0, -1, MAX_ROOM_CAPACITY + 1, 1.5, "2", null, undefined, Number.NaN]) expect(validateCapacityInput(bad).ok).toBe(false);
  });
});

describe("room edit guards (daily-checking data cannot be broken)", () => {
  const room = { roomNumber: "101", capacity: 2, isActive: true, activeStudents: 2 };
  it("capacity can equal but not drop below the active students", () => {
    expect(decideRoomChange({ current: room, patch: { capacity: 2 }, hasCheckHistory: false }).ok).toBe(true);
    expect(decideRoomChange({ current: room, patch: { capacity: 3 }, hasCheckHistory: false }).ok).toBe(true);
    const r = decideRoomChange({ current: room, patch: { capacity: 1 }, hasCheckHistory: false });
    expect(r.ok).toBe(false);
  });
  it("a room with active students cannot be deactivated; an empty one can", () => {
    expect(decideRoomChange({ current: room, patch: { isActive: false }, hasCheckHistory: false }).ok).toBe(false);
    expect(decideRoomChange({ current: { ...room, activeStudents: 0 }, patch: { isActive: false }, hasCheckHistory: true }).ok).toBe(true);
  });
  it("renaming is blocked while checking records exist under the current number", () => {
    expect(decideRoomChange({ current: room, patch: { roomNumber: "111" }, hasCheckHistory: true }).ok).toBe(false);
    expect(decideRoomChange({ current: room, patch: { roomNumber: "111" }, hasCheckHistory: false }).ok).toBe(true);
    expect(decideRoomChange({ current: room, patch: { roomNumber: "101" }, hasCheckHistory: true }).ok).toBe(true); // unchanged number
  });
  it("reactivating a room is always allowed", () => {
    expect(decideRoomChange({ current: { ...room, isActive: false, activeStudents: 0 }, patch: { isActive: true }, hasCheckHistory: true }).ok).toBe(true);
  });
});

describe("room capacity check", () => {
  it("boundaries: one bed left is ok, full is not, inactive is not", () => {
    expect(roomSpaceDecision({ isActive: true, capacity: 2, activeStudents: 1 })).toBe("ok");
    expect(roomSpaceDecision({ isActive: true, capacity: 2, activeStudents: 2 })).toBe("room_full");
    expect(roomSpaceDecision({ isActive: true, capacity: 1, activeStudents: 0 })).toBe("ok");
    expect(roomSpaceDecision({ isActive: false, capacity: 5, activeStudents: 0 })).toBe("room_inactive");
  });
});

describe("Move to Room", () => {
  const target = { roomNumber: "102", isActive: true, capacity: 1, activeStudents: 0 };
  it("an active student needs a free bed", () => {
    expect(decideMove({ studentActive: true, currentRoomId: "a", targetRoomId: "b", target })).toEqual({ ok: true, checkCapacity: true });
    const full = decideMove({ studentActive: true, currentRoomId: "a", targetRoomId: "b", target: { ...target, activeStudents: 1 } });
    expect(full.ok).toBe(false);
    if (!full.ok) expect(full.kind).toBe("conflict");
  });
  it("an inactive student does not occupy a bed, so a full room is allowed until he is reactivated", () => {
    expect(decideMove({ studentActive: false, currentRoomId: "a", targetRoomId: "b", target: { ...target, activeStudents: 1 } })).toEqual({ ok: true, checkCapacity: false });
  });
  it("same room and inactive target rooms are rejected", () => {
    const same = decideMove({ studentActive: true, currentRoomId: "a", targetRoomId: "a", target });
    expect(same.ok).toBe(false);
    if (!same.ok) expect(same.kind).toBe("validation");
    expect(decideMove({ studentActive: false, currentRoomId: "a", targetRoomId: "b", target: { ...target, isActive: false } }).ok).toBe(false);
  });
});

describe("student edit (stable ID, safe patching)", () => {
  const current = { studentCode: "DUMMY-001", name: "Dummy One", parentName: "Dummy Parent", parentEmail: "p@example.com", parentWhatsapp: "+919000000101", secondaryName: null, secondaryEmail: null, secondaryWhatsapp: null, studentPhone: null };
  it("fields that are not sent stay unchanged; sent fields change", () => {
    const m = mergeStudentPatch(current, { name: "Renamed" });
    expect(m.name).toBe("Renamed");
    expect(m.studentCode).toBe("DUMMY-001");
    expect(m.parentWhatsapp).toBe("+919000000101");
  });
  it("null / empty clears optional fields", () => {
    const m = mergeStudentPatch(current, { parentEmail: null, parentName: "" });
    const v = validateStudentFields(m);
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.value.parentEmail).toBeNull();
      expect(v.value.parentName).toBeNull();
    }
  });
  it("clearing a required field is rejected by validation", () => {
    for (const k of ["name", "parentWhatsapp"]) expect(validateStudentFields(mergeStudentPatch(current, { [k]: "" })).ok).toBe(false);
  });
  it("id, roomId and isActive can not be patched through an edit", () => {
    const m = mergeStudentPatch(current, { id: "hack", roomId: "other-room", isActive: false, deactivatedAt: "x" }) as Record<string, unknown>;
    for (const k of ["id", "roomId", "isActive", "deactivatedAt"]) expect(k in m).toBe(false);
  });
  it("a new parent number is normalised and bad numbers are rejected", () => {
    const ok = validateStudentFields(mergeStudentPatch(current, { parentWhatsapp: "98765 00002" }));
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.value.parentWhatsapp).toBe("+919876500002");
    expect(validateStudentFields(mergeStudentPatch(current, { parentWhatsapp: "123" })).ok).toBe(false);
    expect(validateStudentFields(mergeStudentPatch(current, { parentEmail: "nope" })).ok).toBe(false);
  });
});
