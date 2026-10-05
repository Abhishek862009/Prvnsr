import "server-only";
import { redirect } from "next/navigation";
import { en } from "@/messages/en";
import { ApiError } from "@/server/http/api";
import { validateParentSession, type ParentSession } from "@/server/services/parent-auth";
import { resolveStudentAccess, type StudentAccess } from "@/server/services/student-access";
import { validateWardenSession } from "@/server/services/warden-auth";
import { readSessionToken } from "./cookies";

// ---------------- Warden ----------------
export type WardenContext = { wardenId: string; loginId: string };

/** For route handlers: throws 401 unless a valid Warden session exists. */
export async function requireWardenApi(): Promise<WardenContext> {
  const result = await validateWardenSession(await readSessionToken("warden"));
  if (result.ok) return { wardenId: result.wardenId, loginId: result.loginId };
  const message =
    result.reason === "replaced"
      ? en.auth.replacedSession
      : result.reason === "expired"
        ? en.auth.sessionExpired
        : en.auth.notSignedIn;
  throw new ApiError(401, result.reason === "replaced" ? "session_replaced" : "unauthenticated", message);
}

/** For server components/pages: redirects to the login page. */
export async function requireWarden(): Promise<WardenContext> {
  const result = await validateWardenSession(await readSessionToken("warden"));
  if (result.ok) return { wardenId: result.wardenId, loginId: result.loginId };
  redirect(result.reason === "replaced" ? "/admin/login?reason=replaced" : "/admin/login");
}

// ---------------- Parent ----------------
type ParentGuardOptions = {
  /** Only the change-password screen/endpoint sets this. Everything else requires the change first. */
  allowPasswordChangePending?: boolean;
};

export async function requireParentApi(options: ParentGuardOptions = {}): Promise<ParentSession> {
  const session = await validateParentSession(await readSessionToken("parent"));
  if (!session) throw new ApiError(401, "unauthenticated", en.auth.notSignedIn);
  if (session.mustChangePassword && !options.allowPasswordChangePending) {
    throw new ApiError(403, "password_change_required", en.auth.passwordChangeRequired);
  }
  return session;
}

export async function requireParent(options: ParentGuardOptions = {}): Promise<ParentSession> {
  const session = await validateParentSession(await readSessionToken("parent"));
  if (!session) redirect("/parent/login");
  if (session.mustChangePassword && !options.allowPasswordChangePending) redirect("/parent/password");
  return session;
}

/**
 * Every parent endpoint that touches a student must go through this.
 * Unlinked students return 404 so their existence is not revealed.
 */
export async function requireStudentAccessApi(parentId: string, studentId: string): Promise<StudentAccess> {
  const access = await resolveStudentAccess(parentId, studentId);
  if (!access) throw new ApiError(404, "not_found", en.http.notFound);
  return access;
}
