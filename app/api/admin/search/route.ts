import { requireWardenApi } from "@/server/auth/guards";
import { apiHandler, ok } from "@/server/http/api";
import { wardenSearch } from "@/server/services/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Warden-only. ?q=205 (room number first) or ?q=name/code, &inactive=1 to include inactive students. */
export const GET = apiHandler(async (req) => {
  await requireWardenApi();
  const sp = new URL(req.url).searchParams;
  return ok(await wardenSearch(sp.get("q") ?? "", sp.get("inactive") === "1"));
});
