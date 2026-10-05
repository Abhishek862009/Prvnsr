import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const noStore = [{ key: "Cache-Control", value: "no-store, max-age=0" }];

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["@node-rs/argon2"],
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Private zones and their APIs must never be cached by browsers/CDNs.
      { source: "/admin/:path*", headers: noStore },
      { source: "/parent/:path*", headers: noStore },
      { source: "/api/admin/:path*", headers: noStore },
      { source: "/api/parent/:path*", headers: noStore },
      // Public availability must always be fresh on a manual refresh (no browser/CDN caching).
      { source: "/availability", headers: noStore },
      { source: "/api/public/:path*", headers: noStore },
    ];
  },
};

export default config;
