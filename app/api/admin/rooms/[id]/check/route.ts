import { requireWardenApi } from "@/server/auth/guards";
import { apiHandler, ok, readJson } from "@/server/http/api";
import { checkSaveSchema, parseUuid } from "@/server/http/schemas";
import { assertSameOrigin } from "@/server/security/origin";
import { getRoomCheck, saveRoomCheck } from "@/server/services/checking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const GET = apiHandler<Ctx>(async (_req, { params }) => {
  await requireWardenApi();
  return ok(await getRoomCheck(parseUuid((await params).id)));
});

/** Save & Next Room. Returns nextRoomNumber (next pending room, or null when none is left). */
export const PUT = apiHandler<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  await requireWardenApi();
  const id = parseUuid((await params).id);
  const body = await readJson(req, checkSaveSchema);
  return ok(await saveRoomCheck(id, body));
});
