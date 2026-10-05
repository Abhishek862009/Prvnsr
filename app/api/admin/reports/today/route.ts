import { requireWardenApi } from "@/server/auth/guards";
import { apiHandler, ok } from "@/server/http/api";
import { reportFilterSchema } from "@/server/http/schemas";
import { getTodaysReports } from "@/server/services/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ?filter=all|needs_whatsapp */
export const GET = apiHandler(async (req) => {
  await requireWardenApi();
  const filter = reportFilterSchema.parse(new URL(req.url).searchParams.get("filter") ?? "all");
  return ok(await getTodaysReports(filter));
});
