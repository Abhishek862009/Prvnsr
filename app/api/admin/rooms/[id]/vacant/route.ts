import { requireWardenApi } from "@/server/auth/guards";
import { apiHandler, ok, readJson } from "@/server/http/api";
import { parseUuid, vacantSchema } from "@/server/http/schemas";
import { assertSameOrigin } from "@/server/security/origin";
import { setRoomVacant } from "@/server/services/checking";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const POST = apiHandler<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  await requireWardenApi();
  const id = parseUuid((await params).id);
  const { isVacant } = await readJson(req, vacantSchema);
  return ok(await setRoomVacant(id, isVacant));
});
