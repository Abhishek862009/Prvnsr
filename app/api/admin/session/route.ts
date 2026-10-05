import { requireWardenApi } from "@/server/auth/guards";
import { apiHandler, ok } from "@/server/http/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiHandler(async () => {
  const warden = await requireWardenApi();
  return ok({ loginId: warden.loginId });
});
