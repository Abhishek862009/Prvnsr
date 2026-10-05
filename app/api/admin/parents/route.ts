import { requireWardenApi } from "@/server/auth/guards";
import { apiHandler, ok, readJson } from "@/server/http/api";
import { parentCreateSchema } from "@/server/http/schemas";
import { assertSameOrigin } from "@/server/security/origin";
import { createParent, getParentManagement } from "@/server/services/parent-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiHandler(async () => {
  await requireWardenApi();
  return ok(await getParentManagement());
});

/** Body: { mobile, temporaryPassword, studentIds? }. The parent must change the password at first login. */
export const POST = apiHandler(async (req) => {
  assertSameOrigin(req);
  await requireWardenApi();
  return ok({ parent: await createParent(await readJson(req, parentCreateSchema)) }, 201);
});
