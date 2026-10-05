import { requireWardenApi } from "@/server/auth/guards";
import { apiHandler, ok, readJson } from "@/server/http/api";
import { enquiryPatchSchema, parseUuid } from "@/server/http/schemas";
import { assertSameOrigin } from "@/server/security/origin";
import { removeEnquiry, setEnquiryStatus } from "@/server/services/enquiries";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = apiHandler<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  await requireWardenApi();
  const id = parseUuid((await params).id);
  const { status } = await readJson(req, enquiryPatchSchema);
  return ok(await setEnquiryStatus(id, status));
});

/** Manual delete (the 90-day automatic cleanup is a later step). */
export const DELETE = apiHandler<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  await requireWardenApi();
  return ok(await removeEnquiry(parseUuid((await params).id)));
});
