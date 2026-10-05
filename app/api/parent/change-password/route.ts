import { z } from "zod";
import { en } from "@/messages/en";
import { readSessionToken } from "@/server/auth/cookies";
import { requireParentApi } from "@/server/auth/guards";
import { ApiError, apiHandler, ok, readJson } from "@/server/http/api";
import { assertSameOrigin } from "@/server/security/origin";
import { changeParentPassword } from "@/server/services/parent-auth";

export const runtime = "nodejs";

const body = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(1).max(128),
});

export const POST = apiHandler(async (req) => {
  assertSameOrigin(req);
  // The only parent endpoint allowed while a password change is still pending.
  const session = await requireParentApi({ allowPasswordChangePending: true });
  const { currentPassword, newPassword } = await readJson(req, body);
  const token = await readSessionToken("parent");
  if (!token) throw new ApiError(401, "unauthenticated", en.auth.notSignedIn);

  const result = await changeParentPassword({
    parentId: session.parentId,
    currentToken: token,
    currentPassword,
    newPassword,
  });
  if (!result.ok) {
    switch (result.reason) {
      case "weak_password":
        throw new ApiError(
          400,
          "weak_password",
          result.policy === "too_long" ? en.auth.passwordTooLong : en.auth.passwordTooShort,
        );
      case "same_password":
        throw new ApiError(400, "same_password", en.auth.passwordSame);
      default:
        throw new ApiError(400, "wrong_current_password", en.auth.currentPasswordWrong);
    }
  }
  return ok({ ok: true });
});
