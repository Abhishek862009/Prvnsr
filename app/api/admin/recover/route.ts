import { z } from "zod";
import { en } from "@/messages/en";
import { clearSessionCookie } from "@/server/auth/cookies";
import { ApiError, apiHandler, getClientIp, ok, readJson } from "@/server/http/api";
import { assertSameOrigin } from "@/server/security/origin";
import { recoverWardenPassword } from "@/server/services/warden-auth";

export const runtime = "nodejs";

const body = z.object({
  recoveryKey: z.string().min(1).max(256),
  newPassword: z.string().min(1).max(128),
});

export const POST = apiHandler(async (req) => {
  assertSameOrigin(req);
  const { recoveryKey, newPassword } = await readJson(req, body);
  const result = await recoverWardenPassword(recoveryKey, newPassword, getClientIp(req));
  if (!result.ok) {
    switch (result.reason) {
      case "throttled":
        throw new ApiError(429, "throttled", en.auth.tooManyAttempts);
      case "unavailable":
        throw new ApiError(503, "recovery_unavailable", en.auth.recoveryUnavailable);
      case "weak_password":
        throw new ApiError(
          400,
          "weak_password",
          result.policy === "too_long" ? en.auth.passwordTooLong : en.auth.passwordTooShort,
        );
      default:
        throw new ApiError(401, "wrong_recovery_key", en.auth.recoveryFailed);
    }
  }
  await clearSessionCookie("warden");
  return ok({ ok: true });
});
