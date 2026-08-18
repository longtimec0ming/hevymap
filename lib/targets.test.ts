import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getEffectiveTargetBands, getTargetOverrides, resetTargetOverride, setTargetOverride } from "./targets";

// Same in-memory localStorage polyfill pattern as lib/overrides.test.ts —
// vitest's default "node" environment has no `window` global.
class MemoryStorage implements Pick<Storage, "getItem" | "setItem" | "removeItem" | "clear"> {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

describe("lib/targets", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { localStorage: new MemoryStorage() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("getTargetOverrides returns {} when nothing is stored", () => {
    expect(getTargetOverrides()).toEqual({});
  });

  it("setTargetOverride persists a band and getTargetOverrides reads it back", () => {
    setTargetOverride("biceps", [6, 10]);
    expect(getTargetOverrides()).toEqual({ biceps: [6, 10] });
  });

  it("resetTargetOverride removes one override and leaves the rest", () => {
    setTargetOverride("biceps", [6, 10]);
    setTargetOverride("forearms", [3, 5]);

    resetTargetOverride("biceps");

    expect(getTargetOverrides()).toEqual({ forearms: [3, 5] });
  });

  it("getEffectiveTargetBands falls back to the taxonomy default when no override is set", () => {
    const bands = getEffectiveTargetBands();
    expect(bands.lats_upper).toEqual([3, 6]);
    expect(bands.neck).toEqual([1, 3]);
  });

  it("getEffectiveTargetBands prefers a user override over the taxonomy default", () => {
    setTargetOverride("neck", [2, 5]);
    expect(getEffectiveTargetBands().neck).toEqual([2, 5]);
  });

  it("getTargetOverrides migrates a legacy `lats` band onto lats_upper/lats_lower", () => {
    window.localStorage.setItem("hevymap:target-overrides", JSON.stringify({ lats: [8, 12], biceps: [6, 10] }));

    expect(getTargetOverrides()).toEqual({ lats_upper: [8, 12], lats_lower: [8, 12], biceps: [6, 10] });
  });

  it("a legacy `lats` migration doesn't clobber an already-set lats_upper/lats_lower override", () => {
    window.localStorage.setItem(
      "hevymap:target-overrides",
      JSON.stringify({ lats: [8, 12], lats_upper: [4, 7] }),
    );

    expect(getTargetOverrides()).toEqual({ lats_upper: [4, 7], lats_lower: [8, 12] });
  });
});
