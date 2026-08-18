import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  InvalidOverrideError,
  clearOverrides,
  exportOverrides,
  getOverride,
  getOverrides,
  importOverrides,
  removeOverride,
  setOverride,
} from "./overrides";

// Same in-memory localStorage polyfill pattern as lib/storage.test.ts —
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

describe("lib/overrides", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { localStorage: new MemoryStorage() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("getOverrides returns {} when nothing is stored", () => {
    expect(getOverrides()).toEqual({});
  });

  it("setOverride persists a valid contribution map and getOverride reads it back", () => {
    setOverride("custom-1", { upper_chest: 0.6, front_delt: 0.4 });

    expect(getOverride("custom-1")).toEqual({ upper_chest: 0.6, front_delt: 0.4 });
    expect(getOverride("missing-id")).toBeUndefined();
  });

  it("setOverride rejects a contribution map that doesn't sum to 1.0", () => {
    expect(() => setOverride("bad-1", { upper_chest: 0.5 })).toThrow(InvalidOverrideError);
    expect(getOverride("bad-1")).toBeUndefined();
  });

  it("setOverride rejects an invalid (coarse) contribution key", () => {
    expect(() => setOverride("bad-2", { chest: 1.0 } as never)).toThrow(InvalidOverrideError);
  });

  it("removeOverride deletes one entry and leaves the rest", () => {
    setOverride("a", { biceps: 1.0 });
    setOverride("b", { forearms: 1.0 });

    removeOverride("a");

    expect(getOverrides()).toEqual({ b: { forearms: 1.0 } });
  });

  it("export/import round-trips", () => {
    setOverride("a", { biceps: 1.0 });
    setOverride("b", { forearms: 1.0 });

    const json = exportOverrides();
    clearOverrides();
    expect(getOverrides()).toEqual({});

    importOverrides(json);

    expect(getOverrides()).toEqual({ a: { biceps: 1.0 }, b: { forearms: 1.0 } });
  });

  it("importOverrides in merge mode layers on top of existing overrides", () => {
    setOverride("a", { biceps: 1.0 });

    importOverrides(JSON.stringify({ b: { forearms: 1.0 } }));

    expect(getOverrides()).toEqual({ a: { biceps: 1.0 }, b: { forearms: 1.0 } });
  });

  it("importOverrides in replace mode discards existing overrides", () => {
    setOverride("a", { biceps: 1.0 });

    importOverrides(JSON.stringify({ b: { forearms: 1.0 } }), "replace");

    expect(getOverrides()).toEqual({ b: { forearms: 1.0 } });
  });

  it("importOverrides rejects malformed JSON without writing anything", () => {
    setOverride("a", { biceps: 1.0 });

    expect(() => importOverrides("{not json")).toThrow();
    expect(getOverrides()).toEqual({ a: { biceps: 1.0 } });
  });

  it("importOverrides rejects an invalid entry without writing anything", () => {
    setOverride("a", { biceps: 1.0 });

    expect(() => importOverrides(JSON.stringify({ b: { upper_chest: 0.5 } }))).toThrow(InvalidOverrideError);
    expect(getOverrides()).toEqual({ a: { biceps: 1.0 } });
  });

  it("clearOverrides wipes everything", () => {
    setOverride("a", { biceps: 1.0 });
    clearOverrides();
    expect(getOverrides()).toEqual({});
  });

  it("getOverrides migrates a legacy `lats` key into lats_upper/lats_lower 50/50", () => {
    window.localStorage.setItem(
      "hevymap:overrides",
      JSON.stringify({ "custom-lat": { lats: 0.8, biceps: 0.2 } }),
    );

    expect(getOverrides()).toEqual({ "custom-lat": { lats_upper: 0.4, lats_lower: 0.4, biceps: 0.2 } });
  });

  it("getOverrides merges a legacy `lats` share into any existing lats_upper/lats_lower values", () => {
    window.localStorage.setItem(
      "hevymap:overrides",
      JSON.stringify({ "custom-lat": { lats: 0.4, lats_upper: 0.1, lats_lower: 0.1, biceps: 0.4 } }),
    );

    expect(getOverrides()).toEqual({
      "custom-lat": { lats_upper: 0.3, lats_lower: 0.3, biceps: 0.4 },
    });
  });

  it("importOverrides migrates a legacy `lats` key before validating", () => {
    importOverrides(JSON.stringify({ "custom-lat": { lats: 1.0 } }));

    expect(getOverride("custom-lat")).toEqual({ lats_upper: 0.5, lats_lower: 0.5 });
  });
});
