import { requireWardenApi } from "@/server/auth/guards";
import { apiHandler, ok, readText } from "@/server/http/api";
import { importModeFromUrl } from "@/server/http/schemas";
import { ROOM_IMPORT_LIMITS } from "@/server/lib/room-import-format";
import { assertSameOrigin } from "@/server/security/origin";
import { previewRoomImport } from "@/server/services/room-import";

export const runtime = "nodejs";

/** POST ?mode=create|update (default create). Body: raw CSV text. Validates only; writes nothing. */
export const POST = apiHandler(async (req) => {
  assertSameOrigin(req);
  await requireWardenApi();
  const mode = importModeFromUrl(req.url);
  const csv = await readText(req, ROOM_IMPORT_LIMITS.maxBytes);
  return ok({ plan: await previewRoomImport(csv, mode) });
});
