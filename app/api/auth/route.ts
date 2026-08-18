// Password check for the optional access gate (PLAN.md §3). Compares the
// submitted password against ACCESS_PASSWORD server-side only, and sets an
// httpOnly session cookie on success. See proxy.ts for the gate itself and
// lib/auth.ts for the session format.

import { NextRequest, NextResponse } from "next/server";
import { createSession, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS, timingSafeEqualStrings } from "@/lib/auth";

export async function POST(request: NextRequest): Promise<Response> {
  const accessPassword = process.env.ACCESS_PASSWORD;
  if (!accessPassword) {
    // The gate is disabled entirely when ACCESS_PASSWORD is unset — there's
    // nothing to check a password against.
    return NextResponse.json({ error: "Access gate is not enabled." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as { password?: unknown } | null;
  const password = typeof body?.password === "string" ? body.password : "";

  if (!timingSafeEqualStrings(password, accessPassword)) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, createSession(accessPassword), {
    httpOnly: true,
    // Secure cookies require HTTPS; only enforce it in production so local
    // `npm run dev` over plain http still works.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
