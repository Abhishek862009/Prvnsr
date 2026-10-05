import { requireWardenApi } from "@/server/auth/guards";
import { apiHandler, ok, readJson } from "@/server/http/api";
import { completeSchema, parseUuid } from "@/server/http/schemas";
import { assertSameOrigin } from "@/server/security/origin";
import { setRoomComplete } from "@/server/services/checking";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const POST = apiHandler<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  await requireWardenApi();
  const id = parseUuid((await params).id);
  const { isComplete } = await readJson(req, completeSchema);
  return ok(await setRoomComplete(id, isComplete));
});
