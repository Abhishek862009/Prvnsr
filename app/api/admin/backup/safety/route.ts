import { requireWardenApi } from "@/server/auth/guards";
import { ApiError, apiHandler } from "@/server/http/api";
import { getSafetyBackupFile } from "@/server/services/backup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Downloads the encrypted safety copy taken before the most recent restore. */
export const GET = apiHandler(async () => {
  await requireWardenApi();
  const f = await getSafetyBackupFile();
  if (!f) throw new ApiError(404, "not_found", "No safety backup exists yet.");
  return new Response(new Uint8Array(f.buffer), {
    headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${f.filename}"`, "Cache-Control": "no-store" },
  });
});
