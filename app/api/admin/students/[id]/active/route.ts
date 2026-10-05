import { requireWardenApi } from "@/server/auth/guards";
import { apiHandler, ok, readJson } from "@/server/http/api";
import { activeSchema, parseUuid } from "@/server/http/schemas";
import { assertSameOrigin } from "@/server/security/origin";
import { setStudentActive } from "@/server/services/students";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const POST = apiHandler<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  await requireWardenApi();
  const id = parseUuid((await params).id);
  const { isActive } = await readJson(req, activeSchema);
  return ok({ student: await setStudentActive(id, isActive) });
});
