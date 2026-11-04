import { describe, expect, it, vi } from "vitest";
import { normalizeRuntimeConfig } from "../../src/config/resolver/runtime-config.ts";
import type { FastnodeConfig } from "fastnode/types";

const defaultRuntimeConfig = {
  textProperty: "value",
  numberProperty: 42,
  booleanProperty: true,
  arrayProperty: ["A", "B", "C"],
  objectProperty: {
    innerProperty: "value",
  },
  mixedArrayProperty: [
    "A",
    "B",
    {
      inner: {
        innerProperty: "value",
      },
    },
  ],
};

const fastnodeConfig: FastnodeConfig = {
  runtimeConfig: defaultRuntimeConfig,
  baseURL: "https://example.com",
  experimental: {
    envExpansion: false,
  },
};

describe("normalizeRuntimeConfig", () => {
  it("should not warn on a serializable runtime config", () => {
    const warnSpy = vi.spyOn(console, "warn");
    normalizeRuntimeConfig(fastnodeConfig);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("should not warn when primitive prototype is changed", () => {
    const warnSpy = vi.spyOn(console, "warn");

    // https://github.com/khulnasoft/fastnode/pull/2902
    (String.prototype as any).brokenFunction = () => undefined;

    normalizeRuntimeConfig(fastnodeConfig);
    expect(warnSpy).not.toHaveBeenCalled();

    delete (String.prototype as any).brokenFunction;
  });

  it("should throw a warning when runtimeConfig is not serializable", () => {
    // const originalWarn = console.warn;
    const spyWarn = (console.warn = vi.fn());
    normalizeRuntimeConfig({
      ...fastnodeConfig,
      runtimeConfig: {
        ...defaultRuntimeConfig,
        brokenProperty: new Map(),
      },
    });
    console.warn = spyWarn;
    expect(spyWarn).toHaveBeenCalledOnce();
  });
});
