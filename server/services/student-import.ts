import { isProduction } from "@/server/config/env";
import { getDb } from "@/server/db/client";
import { isUniqueViolation } from "@/server/db/errors";
import { DomainError } from "@/server/lib/errors";
import { parseImportCsv, planImport, type ImportPlan } from "@/server/lib/import-plan";
import * as roomsRepo from "@/server/repos/rooms";
import * as studentsRepo from "@/server/repos/students";

/** Dry run: validates the whole file against current data and writes nothing. */
export async function previewStudentImport(csv: string): Promise<ImportPlan> {
  const snapshot = await studentsRepo.loadImportSnapshot();
  return planImport(parseImportCsv(csv), snapshot, { blockSampleData: isProduction() });
}

export type ImportCommitResult = { committed: boolean; created: number; updated: number; plan: ImportPlan };

/**
 * All-or-nothing import. Re-validates inside one transaction (rooms locked), so what is written
 * is exactly what was checked. Any error in any row means nothing is written.
 *
 * Rows with a student_code that matches an existing student UPDATE that student (blank optional
 * cells clear the stored value). Rows without a match CREATE a new student.
 */
export async function commitStudentImport(csv: string): Promise<ImportCommitResult> {
  const parsed = parseImportCsv(csv);
  try {
    return await getDb().transaction(async (tx): Promise<ImportCommitResult> => {
      await roomsRepo.lockAllRooms(tx);
      const snapshot = await studentsRepo.loadImportSnapshot(tx);
      const plan = planImport(parsed, snapshot, { blockSampleData: isProduction() });
      if (!plan.canCommit) return { committed: false, created: 0, updated: 0, plan };

      const creates = plan.rows.filter((r) => r.action === "create");
      await studentsRepo.insertStudents(
        creates.map((r) => {
          if (!r.fields || !r.roomId) throw new Error("Invalid plan");
          return { ...r.fields, roomId: r.roomId };
        }),
        tx,
      );
      const updates = plan.rows.filter((r) => r.action === "update");
      for (const r of updates) {
        if (!r.fields || !r.roomId || !r.studentId) throw new Error("Invalid plan");
        await studentsRepo.updateStudentRow(r.studentId, { ...r.fields, roomId: r.roomId }, tx);
      }
      return { committed: true, created: creates.length, updated: updates.length, plan };
    });
  } catch (err) {
    // The transaction has rolled back: nothing was imported.
    if (isUniqueViolation(err)) {
      throw new DomainError("conflict", "The data conflicts with existing records, so nothing was imported. Run the preview again.");
    }
    throw err;
  }
}
