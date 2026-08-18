import { afterEach, describe, expect, it } from "vitest";
import { decryptHevyApiKey, encryptHevyApiKey } from "./hevy-key";

const ORIGINAL_ENV = { ...process.env };

describe("lib/hevy-key encrypt/decrypt round trip", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("round-trips a plaintext key when ACCESS_PASSWORD is set", () => {
    process.env.ACCESS_PASSWORD = "correct-horse-battery-staple";
    delete process.env.HEVYMAP_SECRET;

    const encrypted = encryptHevyApiKey("hevy-api-key-123");
    expect(encrypted).not.toContain("hevy-api-key-123");
    expect(decryptHevyApiKey(encrypted)).toBe("hevy-api-key-123");
  });

  it("round-trips using HEVYMAP_SECRET when ACCESS_PASSWORD is unset", () => {
    delete process.env.ACCESS_PASSWORD;
    process.env.HEVYMAP_SECRET = "a-standalone-secret";

    const encrypted = encryptHevyApiKey("another-key");
    expect(decryptHevyApiKey(encrypted)).toBe("another-key");
  });

  it("round-trips using a random per-process fallback when neither env var is set", () => {
    delete process.env.ACCESS_PASSWORD;
    delete process.env.HEVYMAP_SECRET;

    const encrypted = encryptHevyApiKey("fallback-key");
    expect(decryptHevyApiKey(encrypted)).toBe("fallback-key");
  });

  it("produces different ciphertext for the same plaintext (random IV per call)", () => {
    process.env.ACCESS_PASSWORD = "same-secret";

    const a = encryptHevyApiKey("same-plaintext");
    const b = encryptHevyApiKey("same-plaintext");

    expect(a).not.toBe(b);
    expect(decryptHevyApiKey(a)).toBe("same-plaintext");
    expect(decryptHevyApiKey(b)).toBe("same-plaintext");
  });

  it("returns null for a corrupt or tampered value instead of throwing", () => {
    expect(decryptHevyApiKey("not-valid-base64-ciphertext")).toBeNull();
    expect(decryptHevyApiKey("")).toBeNull();
  });

  it("fails to decrypt with a different secret than the one used to encrypt", () => {
    process.env.ACCESS_PASSWORD = "secret-one";
    const encrypted = encryptHevyApiKey("secret-payload");

    process.env.ACCESS_PASSWORD = "secret-two";
    expect(decryptHevyApiKey(encrypted)).toBeNull();
  });
});
