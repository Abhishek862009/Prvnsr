// Pure (no imports) so it is safe to use from middleware (edge runtime).
export type SessionKind = "warden" | "parent";

/** "__Host-" prefix (production only) forces Secure + Path=/ + no Domain, so cookies stay host-bound. */
export function cookieName(kind: SessionKind): string {
  const prefix = process.env.NODE_ENV === "production" ? "__Host-" : "";
  return `${prefix}vb_${kind}`;
}
