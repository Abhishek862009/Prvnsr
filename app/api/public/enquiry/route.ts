import { apiHandler, getClientIp, ok, readJson } from "@/server/http/api";
import { publicEnquirySchema } from "@/server/http/schemas";
import { assertSameOrigin } from "@/server/security/origin";
import { submitEnquiry } from "@/server/services/enquiries";

export const runtime = "nodejs";

/**
 * PUBLIC and WRITE-ONLY: there is deliberately no GET handler, so visitors can never read
 * enquiries. The response never contains stored data, only { ok: true }.
 */
export const POST = apiHandler(async (req) => {
  assertSameOrigin(req);
  const { website, ...fields } = await readJson(req, publicEnquirySchema);
  await submitEnquiry(fields, website, getClientIp(req));
  return ok({ ok: true });
});
