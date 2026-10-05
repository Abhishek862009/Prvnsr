import { NextResponse, type NextRequest } from "next/server";
import { cookieName } from "@/server/auth/cookie-names";

/**
 * Cheap first gate: redirects obviously signed-out visitors away from private pages.
 * This is NOT the security boundary. Real validation happens server-side in
 * requireWarden()/requireParent() and in every API handler.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login") && !pathname.startsWith("/admin/recover")) {
    if (!req.cookies.get(cookieName("warden"))) return NextResponse.redirect(new URL("/admin/login", req.url));
  }
  if (pathname.startsWith("/parent") && !pathname.startsWith("/parent/login")) {
    if (!req.cookies.get(cookieName("parent"))) return NextResponse.redirect(new URL("/parent/login", req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*", "/parent/:path*"] };
