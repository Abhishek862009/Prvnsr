import { requireParentApi } from "@/server/auth/guards";
import { apiHandler, ok } from "@/server/http/api";
import { parseUuid } from "@/server/http/schemas";
import { parseRange } from "@/server/lib/parent-report";
import { getStudentHistory } from "@/server/services/parent-portal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ studentId: string }> };

/** ?range=7|30|all. 404 for any student not linked to the signed-in parent. */
export const GET = apiHandler<Ctx>(async (req, { params }) => {
  const parent = await requireParentApi();
  const studentId = parseUuid((await params).studentId);
  const range = parseRange(new URL(req.url).searchParams.get("range"));
  return ok(await getStudentHistory(parent.parentId, studentId, range));
});
