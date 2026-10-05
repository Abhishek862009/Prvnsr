import { requireParentApi } from "@/server/auth/guards";
import { apiHandler, ok, readJson } from "@/server/http/api";
import { acknowledgeSchema, parseUuid } from "@/server/http/schemas";
import { assertSameOrigin } from "@/server/security/origin";
import { acknowledgeReport } from "@/server/services/parent-portal";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ checkId: string }> };

export const POST = apiHandler<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  const parent = await requireParentApi();
  const checkId = parseUuid((await params).checkId);
  const { revision } = await readJson(req, acknowledgeSchema);
  return ok(await acknowledgeReport(parent.parentId, checkId, revision));
});
