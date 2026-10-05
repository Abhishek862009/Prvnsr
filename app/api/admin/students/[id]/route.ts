import { requireWardenApi } from "@/server/auth/guards";
import { apiHandler, ok, readJson } from "@/server/http/api";
import { parseUuid, studentPatchSchema } from "@/server/http/schemas";
import { assertSameOrigin } from "@/server/security/origin";
import { getStudent, updateStudent } from "@/server/services/students";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const GET = apiHandler<Ctx>(async (_req, { params }) => {
  await requireWardenApi();
  return ok({ student: await getStudent(parseUuid((await params).id)) });
});

export const PATCH = apiHandler<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  await requireWardenApi();
  const id = parseUuid((await params).id);
  const body = await readJson(req, studentPatchSchema);
  return ok({ student: await updateStudent(id, body) });
});
