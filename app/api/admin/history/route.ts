import { requireWardenApi } from "@/server/auth/guards";
import { apiHandler, ok } from "@/server/http/api";
import { getWardenHistory } from "@/server/services/history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Warden-only. Query: view=date|student|room, from, to, room, q, status, stars, page.
 * The date range is always clamped to the 30-day retention window.
 */
export const GET = apiHandler(async (req) => {
  await requireWardenApi();
  return ok(await getWardenHistory(Object.fromEntries(new URL(req.url).searchParams)));
});
