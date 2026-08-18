// Access-password session helpers, shared by the login API route
// (app/api/auth/route.ts) and the root proxy/gate (proxy.ts). See
// PLAN.md §3: if ACCESS_PASSWORD is unset, this module is never
// consulted and there is no gate.
//
// Sessions are a signed cookie, not a server-side store (this app has no
// database): `${expiresAtMs}.${hmac}`, where the HMAC key is the access
// password itself. That means a session is only ever valid for the
// password that minted it — rotating ACCESS_PASSWORD invalidates every
// existing cookie for free.

import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE_NAME = "hevymap_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/** Builds a fresh signed session cookie value, expiring in SESSION_MAX_AGE_SECONDS. */
export function createSession(secret: string): string {
  const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const payload = String(expiresAt);
  return `${payload}.${sign(payload, secret)}`;
}

/** Verifies a session cookie value against the current access password and expiry. */
export function isValidSession(cookieValue: string, secret: string): boolean {
  const dotIndex = cookieValue.lastIndexOf(".");
  if (dotIndex === -1) return false;

  const payload = cookieValue.slice(0, dotIndex);
  const signature = cookieValue.slice(dotIndex + 1);

  const expiresAt = Number(payload);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;

  const expected = Buffer.from(sign(payload, secret), "hex");
  let actual: Buffer;
  try {
    actual = Buffer.from(signature, "hex");
  } catch {
    return false;
  }
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

/** Constant-time string comparison for the submitted-password check. */
export function timingSafeEqualStrings(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
}
