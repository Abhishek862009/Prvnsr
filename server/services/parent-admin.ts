import { getDb } from "@/server/db/client";
import { isUniqueViolation } from "@/server/db/errors";
import { checkPasswordPolicy, hashPassword } from "@/server/auth/password";
import { DomainError } from "@/server/lib/errors";
import { normalizePhone } from "@/server/lib/phone";
import * as adminRepo from "@/server/repos/parent-admin";
import * as parentsRepo from "@/server/repos/parents";
import { adminSetParentTemporaryPassword } from "./parent-auth";

/**
 * Warden-side parent account management. Links are ALWAYS created by the Warden: the system may
 * suggest students that share a parent's number, but never links them on its own.
 * Parent ID = the parent's primary mobile number in E.164, so it is normalised everywhere.
 */
const mobileOrThrow = (input: string): string => {
  const m = normalizePhone(input);
  if (!m) throw new DomainError("validation", "Enter a valid mobile number for the parent.");
  return m;
};

const passwordOrThrow = (pw: string) => {
  const p = checkPasswordPolicy(pw);
  if (p) throw new DomainError("validation", p === "too_short" ? "Password must be at least 8 characters." : "Password must be at most 128 characters.");
};

async function accountOrThrow(id: string) {
  const a = await parentsRepo.findParentById(id);
  if (!a) throw new DomainError("not_found", "Parent account not found.");
  return a;
}

export async function getParentManagement() {
  const [accounts, links, students] = await Promise.all([
    adminRepo.listParentAccounts(),
    adminRepo.listAllLinks(),
    adminRepo.listStudentsForLinking(),
  ]);
  const byId = new Map(students.map((s) => [s.studentId, s]));
  return {
    parents: accounts.map((a) => ({
      ...a,
      students: links
        .filter((l) => l.parentId === a.id)
        .map((l) => byId.get(l.studentId))
        .filter((s): s is NonNullable<typeof s> => !!s),
    })),
    students,
    linkedStudentIds: [...new Set(links.map((l) => l.studentId))],
  };
}

/** Creates an account with a TEMPORARY password (the parent must change it at first login) and optional links. */
export async function createParent(input: { mobile: string; temporaryPassword: string; studentIds: string[] }) {
  const mobile = mobileOrThrow(input.mobile);
  passwordOrThrow(input.temporaryPassword);
  const studentIds = [...new Set(input.studentIds)];
  if ((await adminRepo.countExistingStudents(studentIds)) !== studentIds.length) {
    throw new DomainError("validation", "One of the selected students does not exist.");
  }
  if (await parentsRepo.findParentByMobile(mobile)) {
    throw new DomainError("conflict", "A parent account with this mobile number already exists. Link more students to it instead.");
  }
  const passwordHash = await hashPassword(input.temporaryPassword);
  try {
    return await getDb().transaction(async (tx) => {
      const row = await adminRepo.insertAccount({ mobileE164: mobile, passwordHash }, tx);
      if (!row) throw new DomainError("conflict", "Account could not be created.");
      await adminRepo.insertLinks(row.id, studentIds, tx);
      return { id: row.id, mobileE164: row.mobileE164, linked: studentIds.length };
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new DomainError("conflict", "A parent account with this mobile number already exists.");
    throw err;
  }
}

/** The parent's number changed. Their login ID changes with it, so every session is ended. */
export async function changeParentMobile(parentId: string, mobileInput: string) {
  await accountOrThrow(parentId);
  const mobile = mobileOrThrow(mobileInput);
  const existing = await parentsRepo.findParentByMobile(mobile);
  if (existing && existing.id !== parentId) throw new DomainError("conflict", "Another parent account already uses this number.");
  try {
    await getDb().transaction(async (tx) => {
      await adminRepo.updateMobile(parentId, mobile, tx);
      await parentsRepo.deleteParentSessions(parentId, undefined, tx);
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new DomainError("conflict", "Another parent account already uses this number.");
    throw err;
  }
  return { id: parentId, mobileE164: mobile };
}

/** Forgot password / first setup: sets a temporary password, forces a change at next login, ends sessions. */
export async function resetParentPassword(parentId: string, temporaryPassword: string) {
  await accountOrThrow(parentId);
  const r = await adminSetParentTemporaryPassword(parentId, temporaryPassword);
  if (!r.ok) passwordOrThrow(temporaryPassword);
  return { id: parentId, mustChangePassword: true as const };
}

export async function linkStudent(parentId: string, studentId: string) {
  await accountOrThrow(parentId);
  if ((await adminRepo.countExistingStudents([studentId])) !== 1) throw new DomainError("not_found", "Student not found.");
  await adminRepo.insertLinks(parentId, [studentId]); // idempotent
  return { parentId, studentId };
}

export async function unlinkStudent(parentId: string, studentId: string) {
  await accountOrThrow(parentId);
  if (!(await adminRepo.deleteLink(parentId, studentId))) throw new DomainError("not_found", "That student is not linked to this parent.");
  return { parentId, studentId };
}

/** Only an account with no linked students can be deleted (it protects acknowledgement history of linked children). */
export async function deleteParent(parentId: string) {
  await accountOrThrow(parentId);
  if ((await adminRepo.countLinks(parentId)) > 0) {
    throw new DomainError("conflict", "Unlink all students before deleting this parent account.");
  }
  await adminRepo.deleteAccount(parentId);
  return { deleted: true as const };
}
