import type { NextConfig } from "next";

// Baseline security headers for every route. Kept to headers that are safe
// to apply without app-specific testing (no CSP here — Recharts and
// shadcn/ui rely on inline styles, and this app has no dev/build cycle
// available in this change to verify a CSP wouldn't break rendering; see
// the security audit notes for a recommended policy to adopt deliberately).
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Equivalent to a `frame-ancestors 'none'` CSP directive — this app has
  // no legitimate reason to be framed.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
