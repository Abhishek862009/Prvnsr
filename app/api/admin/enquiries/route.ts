import { requireWardenApi } from "@/server/auth/guards";
import { apiHandler, ok } from "@/server/http/api";
import { enquiryListQuerySchema } from "@/server/http/schemas";
import { enquiryCounts, listEnquiries } from "@/server/services/enquiries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req) => {
  await requireWardenApi();
  const status = enquiryListQuerySchema.parse(new URL(req.url).searchParams.get("status") ?? undefined);
  const [enquiries, counts] = await Promise.all([listEnquiries(status), enquiryCounts()]);
  return ok({ enquiries, counts });
});
