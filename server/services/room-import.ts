import { isProduction } from "@/server/config/env";
import { getDb } from "@/server/db/client";
import { isUniqueViolation } from "@/server/db/errors";
import { DomainError } from "@/server/lib/errors";
import { parseRoomImportCsv, planRoomImport, type RoomImportMode, type RoomImportPlan } from "@/server/lib/room-import-plan";
import * as roomsRepo from "@/server/repos/rooms";

/** Dry run: validates the whole file against current rooms and writes nothing. */
export async function previewRoomImport(csv: string, mode: RoomImportMode): Promise<RoomImportPlan> {
  const snapshot = await roomsRepo.loadRoomImportSnapshot();
  return planRoomImport(parseRoomImportCsv(csv), snapshot, mode, { blockSampleData: isProduction() });
}

export type RoomImportCommitResult = { committed: boolean; created: number; updated: number; plan: RoomImportPlan };

/** All-or-nothing. Re-validates inside one transaction with all rooms locked. */
export async function commitRoomImport(csv: string, mode: RoomImportMode): Promise<RoomImportCommitResult> {
  const parsed = parseRoomImportCsv(csv);
  try {
    return await getDb().transaction(async (tx): Promise<RoomImportCommitResult> => {
      await roomsRepo.lockAllRooms(tx);
      const snapshot = await roomsRepo.loadRoomImportSnapshot(tx);
      const plan = planRoomImport(parsed, snapshot, mode, { blockSampleData: isProduction() });
      if (!plan.canCommit) return { committed: false, created: 0, updated: 0, plan };

      const creates = plan.rows.filter((r) => r.action === "create");
      await roomsRepo.insertRooms(
        creates.map((r) => {
          if (r.floor === null || r.capacity === null) throw new Error("Invalid plan");
          return { roomNumber: r.roomNumber, floor: r.floor, capacity: r.capacity };
        }),
        tx,
      );
      const updates = plan.rows.filter((r) => r.action === "update");
      for (const r of updates) {
        if (!r.roomId || r.capacity === null) throw new Error("Invalid plan");
        await roomsRepo.updateRoomRow(r.roomId, { capacity: r.capacity }, tx);
      }
      return { committed: true, created: creates.length, updated: updates.length, plan };
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new DomainError("conflict", "A room with one of these numbers was just created, so nothing was imported. Run the preview again.");
    }
    throw err;
  }
}
