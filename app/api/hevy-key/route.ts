// In-app "paste your Hevy API key" flow, for deployments that don't have
// HEVY_API_KEY set server-side. See components/import/import-screen.tsx and
// lib/hevy-key.ts.
//
// GET    -> { source: "env" | "cookie" | "none" } — lets the connect screen
//           and settings page decide what to render without ever exposing
//           the key itself.
// POST   -> { apiKey } — validates the key against the real Hevy API
//           (GET /v1/workouts/count) before storing anything; on success,
//           sets the encrypted cookie.
// DELETE -> clears the cookie ("Disconnect").

import { NextRequest, NextResponse } from "next/server";
import { clearHevyKeyCookie, getHevyKeyFromRequest, setHevyKeyCookie } from "@/lib/hevy-key";

const HEVY_API_BASE = "https://api.hevyapp.com/v1";

export async function GET(request: NextRequest): Promise<Response> {
  if (process.env.HEVY_API_KEY) {
    return NextResponse.json({ source: "env" });
  }
  const cookieKey = getHevyKeyFromRequest(request);
  return NextResponse.json({ source: cookieKey ? "cookie" : "none" });
}

export async function POST(request: NextRequest): Promise<Response> {
  if (process.env.HEVY_API_KEY) {
    // The server already has a key configured; there's nothing for a
    // user-supplied key to do (and app/api/hevy proxies with env taking
    // precedence anyway, so storing one here would be silently ignored).
    return NextResponse.json({ error: "server_key_configured" }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as { apiKey?: unknown } | null;
  const apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
  if (!apiKey) {
    return NextResponse.json({ error: "missing_api_key" }, { status: 400 });
  }

  let verifyResponse: Response;
  try {
    verifyResponse = await fetch(`${HEVY_API_BASE}/workouts/count`, {
      headers: { "api-key": apiKey, accept: "application/json" },
      cache: "no-store",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "hevy_unreachable", detail: error instanceof Error ? error.message : String(error) },
      { status: 502 },
    );
  }

  if (!verifyResponse.ok) {
    return NextResponse.json({ error: "invalid_api_key" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  setHevyKeyCookie(response, apiKey);
  return response;
}

export async function DELETE(): Promise<Response> {
  const response = NextResponse.json({ ok: true });
  clearHevyKeyCookie(response);
  return response;
}
