import { requireWardenApi } from "@/server/auth/guards";
import { apiHandler, ok, readJson } from "@/server/http/api";
import { parentMobileSchema, parseUuid } from "@/server/http/schemas";
import { assertSameOrigin } from "@/server/security/origin";
import { changeParentMobile, deleteParent } from "@/server/services/parent-admin";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** Change the parent's login mobile number (ends their sessions). */
export const PATCH = apiHandler<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  await requireWardenApi();
  const id = parseUuid((await params).id);
  const { mobile } = await readJson(req, parentMobileSchema);
  return ok({ parent: await changeParentMobile(id, mobile) });
});

export const DELETE = apiHandler<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  await requireWardenApi();
  return ok(await deleteParent(parseUuid((await params).id)));
});
