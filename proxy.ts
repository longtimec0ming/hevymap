// Access-password gate (PLAN.md §3, CLAUDE.md build step 7).
//
// Note: this repo runs Next.js 16, where the `middleware.ts` file
// convention is deprecated in favor of `proxy.ts` (same behavior, renamed
// file/export — see node_modules/next/dist/docs/.../file-conventions/proxy.md).
// This file is the current-convention equivalent of the `middleware.ts`
// PLAN.md describes.
//
// If ACCESS_PASSWORD is unset, this is a no-op on every request — the
// common local-dev case. If it's set, every route (pages AND the /api/hevy
// proxy) requires a valid session cookie, except /login and /api/auth
// themselves, which must stay reachable to log in at all.

import { NextResponse, type NextRequest } from "next/server";
import { isValidSession, SESSION_COOKIE_NAME } from "@/lib/auth";

export function proxy(request: NextRequest): NextResponse {
  const accessPassword = process.env.ACCESS_PASSWORD;
  if (!accessPassword) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (cookie && isValidSession(cookie, accessPassword)) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  // API routes get a 401 instead of a redirect: callers (lib/hevy.ts) parse
  // the response as JSON and treat any non-ok status as an error. A 3xx
  // redirect to the login *page* would be transparently followed by fetch()
  // and return a 200 with an HTML body, which would be silently parsed as
  // (garbage) JSON instead of failing loudly.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    // Everything except: login page, its own auth API route, Next's
    // internal static/image assets, and favicon.ico.
    "/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
