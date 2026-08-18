// Server-side proxy to the Hevy API. This is the ONLY place HEVY_API_KEY is
// read. Client code must never call api.hevyapp.com directly — see
// CLAUDE.md's hard invariant #1 and the `Client fetches go only to /api/*`
// convention.

import { NextRequest } from "next/server";

const HEVY_API_BASE = "https://api.hevyapp.com/v1";

// Methods Hevy's API actually supports across its endpoints (workouts,
// exercise_templates, routines, ...). We forward all of them generically
// rather than special-casing per-endpoint.
const FORWARDED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

async function forward(request: NextRequest, path: string[]): Promise<Response> {
  const apiKey = process.env.HEVY_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "HEVY_API_KEY is not configured on the server." },
      { status: 500 },
    );
  }

  const targetUrl = `${HEVY_API_BASE}/${path.join("/")}${request.nextUrl.search}`;

  const headers = new Headers();
  headers.set("api-key", apiKey);
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  headers.set("accept", "application/json");

  const hasBody = request.method !== "GET" && request.method !== "HEAD";

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: hasBody ? await request.text() : undefined,
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
