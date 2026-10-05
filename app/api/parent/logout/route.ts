import { clearSessionCookie, readSessionToken } from "@/server/auth/cookies";
import { apiHandler, ok } from "@/server/http/api";
import { assertSameOrigin } from "@/server/security/origin";
import { parentLogout } from "@/server/services/parent-auth";

export const runtime = "nodejs";

export const POST = apiHandler(async (req) => {
  assertSameOrigin(req);
  await parentLogout(await readSessionToken("parent"));
  await clearSessionCookie("parent");
  return ok({ ok: true });
});
