import { requireWardenApi } from "@/server/auth/guards";
import { ApiError, apiHandler, ok, readText } from "@/server/http/api";
import { importModeFromUrl } from "@/server/http/schemas";
import { ROOM_IMPORT_LIMITS } from "@/server/lib/room-import-format";
import { assertSameOrigin } from "@/server/security/origin";
import { commitRoomImport } from "@/server/services/room-import";

export const runtime = "nodejs";

/** POST ?mode=create|update. Body: the same CSV that was previewed. Applies everything or nothing. */
export const POST = apiHandler(async (req) => {
  assertSameOrigin(req);
  await requireWardenApi();
  const mode = importModeFromUrl(req.url);
  const csv = await readText(req, ROOM_IMPORT_LIMITS.maxBytes);
  const result = await commitRoomImport(csv, mode);
  if (!result.committed) throw new ApiError(422, "import_has_errors", "The file has errors or nothing to change. Nothing was imported.");
  return ok({ committed: true, created: result.created, updated: result.updated });
});
