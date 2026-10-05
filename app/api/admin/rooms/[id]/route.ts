import { requireWardenApi } from "@/server/auth/guards";
import { apiHandler, ok, readJson } from "@/server/http/api";
import { parseUuid, roomPatchSchema } from "@/server/http/schemas";
import { assertSameOrigin } from "@/server/security/origin";
import { updateRoom } from "@/server/services/rooms";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = apiHandler<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  await requireWardenApi();
  const id = parseUuid((await params).id);
  const body = await readJson(req, roomPatchSchema);
  return ok({ room: await updateRoom(id, body) });
});
