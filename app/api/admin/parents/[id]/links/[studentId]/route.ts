import { requireWardenApi } from "@/server/auth/guards";
import { apiHandler, ok } from "@/server/http/api";
import { parseUuid } from "@/server/http/schemas";
import { assertSameOrigin } from "@/server/security/origin";
import { unlinkStudent } from "@/server/services/parent-admin";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; studentId: string }> };

export const DELETE = apiHandler<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  await requireWardenApi();
  const p = await params;
  return ok(await unlinkStudent(parseUuid(p.id), parseUuid(p.studentId)));
});
