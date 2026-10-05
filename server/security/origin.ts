import { en } from "@/messages/en";
import { ApiError } from "@/server/http/api";

/**
 * CSRF defence for state-changing route handlers (in addition to SameSite=Lax cookies):
 * the request must come from our own origin.
 */
export function assertSameOrigin(req: Request): void {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") throw new ApiError(403, "cross_origin", en.http.crossOrigin);

  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin || !host) throw new ApiError(403, "cross_origin", en.http.crossOrigin);

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new ApiError(403, "cross_origin", en.http.crossOrigin);
  }
  if (originHost !== host) throw new ApiError(403, "cross_origin", en.http.crossOrigin);
}
