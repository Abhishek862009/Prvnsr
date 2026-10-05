import { requireWardenApi } from "@/server/auth/guards";
import { apiHandler, ok, readJson } from "@/server/http/api";
import { moveSchema, parseUuid } from "@/server/http/schemas";
import { assertSameOrigin } from "@/server/security/origin";
import { moveStudent } from "@/server/services/students";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const POST = apiHandler<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  await requireWardenApi();
  const id = parseUuid((await params).id);
  const { roomId } = await readJson(req, moveSchema);
  return ok({ student: await moveStudent(id, roomId) });
});
