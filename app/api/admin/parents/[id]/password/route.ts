import { requireWardenApi } from "@/server/auth/guards";
import { apiHandler, ok, readJson } from "@/server/http/api";
import { parentPasswordSchema, parseUuid } from "@/server/http/schemas";
import { assertSameOrigin } from "@/server/security/origin";
import { resetParentPassword } from "@/server/services/parent-admin";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** Sets a temporary password: must_change_password is switched on and all sessions end. */
export const POST = apiHandler<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  await requireWardenApi();
  const id = parseUuid((await params).id);
  const { temporaryPassword } = await readJson(req, parentPasswordSchema);
  return ok(await resetParentPassword(id, temporaryPassword));
});
