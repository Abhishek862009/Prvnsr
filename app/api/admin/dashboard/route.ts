import { requireWardenApi } from "@/server/auth/guards";
import { apiHandler, ok } from "@/server/http/api";
import { getDashboard } from "@/server/services/checking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiHandler(async () => {
  await requireWardenApi();
  return ok(await getDashboard());
});
