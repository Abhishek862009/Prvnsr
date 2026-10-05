import { NextResponse } from "next/server";
import { getEnv } from "@/server/config/env";
import { ApiError, apiHandler } from "@/server/http/api";
import { isCronAuthorized } from "@/server/lib/cron-auth";
import { runCleanup } from "@/server/services/cleanup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily cleanup. A plain protected endpoint (no hosting-specific code), so any scheduler can call it:
 *   curl -X POST https://<site>/api/cron/cleanup -H "Authorization: Bearer $CRON_SECRET"
 * GET is accepted too because some schedulers (e.g. Vercel Cron) only issue GET.
 * Anything without the exact CRON_SECRET gets 401 and nothing is deleted.
 */
const handle = apiHandler(async (req) => {
  if (!isCronAuthorized(req.headers.get("authorization"), getEnv().CRON_SECRET)) {
    throw new ApiError(401, "unauthorized", "Unauthorized.");
  }
  return NextResponse.json(await runCleanup(), { headers: { "Cache-Control": "no-store" } });
});

export const GET = handle;
export const POST = handle;
