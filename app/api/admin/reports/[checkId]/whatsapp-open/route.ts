import { requireWardenApi } from "@/server/auth/guards";
import { apiHandler, ok, readJson } from "@/server/http/api";
import { parseUuid, whatsappOpenSchema } from "@/server/http/schemas";
import { assertSameOrigin } from "@/server/security/origin";
import { recordWhatsappOpened } from "@/server/services/reports";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ checkId: string }> };

/** Logs that the Warden OPENED WhatsApp for this report revision. Does not send anything. */
export const POST = apiHandler<Ctx>(async (req, { params }) => {
  assertSameOrigin(req);
  await requireWardenApi();
  const checkId = parseUuid((await params).checkId);
  const { revision } = await readJson(req, whatsappOpenSchema);
  return ok(await recordWhatsappOpened(checkId, revision));
});
