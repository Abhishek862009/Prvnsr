import { clearSessionCookie, readSessionToken } from "@/server/auth/cookies";
import { apiHandler, ok } from "@/server/http/api";
import { assertSameOrigin } from "@/server/security/origin";
import { wardenLogout } from "@/server/services/warden-auth";

export const runtime = "nodejs";

export const POST = apiHandler(async (req) => {
  assertSameOrigin(req);
  await wardenLogout(await readSessionToken("warden"));
  await clearSessionCookie("warden");
  return ok({ ok: true });
});
