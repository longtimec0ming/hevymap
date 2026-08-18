// Server-only helper for the in-app Hevy API key connect flow (PLAN.md
// data-source B in the follow-up spec: users without a server-configured
// HEVY_API_KEY can paste their own key, which we store client-side as an
// encrypted, httpOnly cookie — never in localStorage/IndexedDB, never sent
// to client JS, never logged).
//
// Encryption: AES-256-GCM via node:crypto. The encryption key is derived
// (scrypt) from, in order: ACCESS_PASSWORD (if set) -> HEVYMAP_SECRET (if
// set) -> a random secret generated once per server process. That last case
// means the cookie can never be decrypted after a server restart (the
// secret is gone) — the connection is silently lost and the user just
// reconnects. See README's "Bring your own API key" section.
//
// This module must only be imported from server-side code (API routes).
// It touches process.env and node:crypto and has no client-safe use.

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

export const HEVY_KEY_COOKIE_NAME = "hevymap_hevy_key";
const HEVY_KEY_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year

// Fixed, non-secret salt: scrypt still requires one, but the secret itself
// (ACCESS_PASSWORD / HEVYMAP_SECRET / the random fallback) is what actually
// has to stay unknown to an attacker, not the salt.
const SCRYPT_SALT = "hevymap:hevy-api-key:v1";
const AES_ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;

// Generated lazily, once per server process, only if neither env var is
// set. Module-level singleton so it's stable for the process's lifetime
// (restarting the process is exactly when it should change).
let processSecret: string | null = null;

function getSecret(): string {
  if (process.env.ACCESS_PASSWORD) return process.env.ACCESS_PASSWORD;
  if (process.env.HEVYMAP_SECRET) return process.env.HEVYMAP_SECRET;
  if (!processSecret) processSecret = randomBytes(32).toString("hex");
  return processSecret;
}

function deriveKey(secret: string): Buffer {
  return scryptSync(secret, SCRYPT_SALT, 32);
}

/** Encrypts a plaintext Hevy API key for storage in the cookie. */
export function encryptHevyApiKey(plaintext: string): string {
  const key = deriveKey(getSecret());
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(AES_ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

/** Decrypts a cookie value back to the plaintext API key. Returns null on
 * any failure (corrupt value, wrong/rotated secret, tampering) rather than
 * throwing — callers should treat that the same as "not connected". */
export function decryptHevyApiKey(encoded: string): string | null {
  try {
    const buf = Buffer.from(encoded, "base64");
    const iv = buf.subarray(0, IV_LENGTH_BYTES);
    const authTag = buf.subarray(IV_LENGTH_BYTES, IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES);
    const ciphertext = buf.subarray(IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES);
    const key = deriveKey(getSecret());
    const decipher = createDecipheriv(AES_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString("utf8");
  } catch {
    return null;
  }
}

/** Reads and decrypts the Hevy API key cookie off an incoming request, if
 * present and valid. Does not consider HEVY_API_KEY — callers combine the
 * two (env var takes precedence; see app/api/hevy/[...path]/route.ts). */
export function getHevyKeyFromRequest(request: NextRequest): string | null {
  const raw = request.cookies.get(HEVY_KEY_COOKIE_NAME)?.value;
  if (!raw) return null;
  return decryptHevyApiKey(raw);
}

/** Sets the encrypted cookie on a response after a key has been validated
 * against the Hevy API. */
export function setHevyKeyCookie(response: NextResponse, apiKey: string): void {
  response.cookies.set(HEVY_KEY_COOKIE_NAME, encryptHevyApiKey(apiKey), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: HEVY_KEY_COOKIE_MAX_AGE_SECONDS,
  });
}

/** Clears the Hevy API key cookie (settings/connect-screen "Disconnect"). */
export function clearHevyKeyCookie(response: NextResponse): void {
  response.cookies.delete(HEVY_KEY_COOKIE_NAME);
}
