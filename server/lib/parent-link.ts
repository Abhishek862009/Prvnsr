export type LinkCandidate = { studentId: string; name: string; roomNumber: string; parentWhatsapp: string | null; isActive: boolean };

/**
 * The system only SUGGESTS links: students whose primary parent number equals this parent's login number
 * and who are not linked yet. The Warden confirms every link.
 */
export function suggestLinks(parentMobile: string, students: readonly LinkCandidate[], alreadyLinked: ReadonlySet<string>): LinkCandidate[] {
  return students.filter((s) => s.parentWhatsapp === parentMobile && !alreadyLinked.has(s.studentId));
}

/** Students with no parent account at all, i.e. nobody can see their reports yet. */
export function studentsWithoutParent(students: readonly LinkCandidate[], linkedStudentIds: ReadonlySet<string>): LinkCandidate[] {
  return students.filter((s) => s.isActive && !linkedStudentIds.has(s.studentId));
}
