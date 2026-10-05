import { z } from "zod";
import { en } from "@/messages/en";
import { setSessionCookie } from "@/server/auth/cookies";
import { ApiError, apiHandler, getClientIp, ok, readJson } from "@/server/http/api";
import { assertSameOrigin } from "@/server/security/origin";
import { wardenLogin } from "@/server/services/warden-auth";

export const runtime = "nodejs";

const body = z.object({
  loginId: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(128),
});

export const POST = apiHandler(async (req) => {
  assertSameOrigin(req);
  const { loginId, password } = await readJson(req, body);
  const result = await wardenLogin(loginId, password, getClientIp(req));
  if (!result.ok) {
    if (result.reason === "throttled") throw new ApiError(429, "throttled", en.auth.tooManyAttempts);
    throw new ApiError(401, "invalid_credentials", en.auth.invalidCredentials);
  }
  await setSessionCookie("warden", result.token, result.expiresAt);
  return ok({ ok: true });
});
