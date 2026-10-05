import { requireWardenApi } from "@/server/auth/guards";
import { apiHandler, ok, readJson } from "@/server/http/api";
import { parentLinkSchema, parseUuid } from "@/server/http/schemas";
import { assertSameOrigin } from "@/server/security/origin";
import { linkStudent } from "@/server/services/parent-admin";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** The Warden links a student to this parent (never done automatically). */
export const POST = apiHandler<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  await requireWardenApi();
  const id = parseUuid((await params).id);
  const { studentId } = await readJson(req, parentLinkSchema);
  return ok(await linkStudent(id, studentId), 201);
});
