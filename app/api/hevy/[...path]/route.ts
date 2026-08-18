// Server-side proxy to the Hevy API. This is the ONLY place HEVY_API_KEY is
// read. Client code must never call api.hevyapp.com directly — see
// CLAUDE.md's hard invariant #1 and the `Client fetches go only to /api/*`
// convention.

import { NextRequest } from "next/server";
import { getHevyKeyFromRequest } from "@/lib/hevy-key";

const HEVY_API_BASE = "https://api.hevyapp.com/v1";

// HevyMap only ever reads from Hevy (see PLAN.md — no write flows exist in
// the app; lib/hevy.ts's client only issues GET). Restricting the proxy to
// GET keeps it from becoming a generic authenticated write-proxy to a
// third-party API if a future bug (here or in a fork) ever lets an
// attacker control the path/body.
const FORWARDED_METHODS = ["GET"] as const;

async function forward(request: NextRequest, path: string[]): Promise<Response> {
  // Reject path segments that could walk the request outside `/v1/...` on
  // api.hevyapp.com (e.g. `..`). This can't reach a different host — the
  // segments are string-joined onto HEVY_API_BASE, never used to build a
  // new origin — but it's a cheap belt-and-braces check against hitting
  // unintended upstream paths.
  if (path.some((segment) => segment === "." || segment === "..")) {
    return Response.json({ error: "Invalid path." }, { status: 400 });
  }

  // Resolution order: server-configured HEVY_API_KEY -> the user's own key
  // (pasted via /api/hevy-key, stored as an encrypted cookie) -> no key at
  // all. lib/hevy.ts's client recognizes the "no_api_key" error and routes
  // the user back to the connect screen.
  const apiKey = process.env.HEVY_API_KEY ?? getHevyKeyFromRequest(request);
  if (!apiKey) {
    return Response.json({ error: "no_api_key" }, { status: 401 });
  }

  const targetUrl = `${HEVY_API_BASE}/${path.join("/")}${request.nextUrl.search}`;

  // Only the headers Hevy's API actually needs. Client-sent headers (its
  // own cookies, auth, etc.) are never forwarded upstream.
  const headers = new Headers();
  headers.set("api-key", apiKey);
  headers.set("accept", "application/json");

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(targetUrl, {
      method: "GET",
      headers,
      // Never cache API responses; workout data changes constantly and
      // this is a stateless proxy, not a cache layer.
      cache: "no-store",
    });
  } catch (error) {
    return Response.json(
      {
        error: "Failed to reach the Hevy API.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 502 },
    );
  }

  const responseText = await upstreamResponse.text();
  const responseContentType = upstreamResponse.headers.get("content-type") ?? "application/json";

  return new Response(responseText, {
    status: upstreamResponse.status,
    headers: { "content-type": responseContentType },
  });
}

interface RouteParams {
  params: Promise<{ path: string[] }>;
}

async function handle(request: NextRequest, { params }: RouteParams): Promise<Response> {
  if (!FORWARDED_METHODS.includes(request.method as (typeof FORWARDED_METHODS)[number])) {
    return Response.json({ error: `Method ${request.method} not supported.` }, { status: 405 });
  }
  const { path } = await params;
  return forward(request, path);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
