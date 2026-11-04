import { describe, expect, it, vi } from "vitest";
import { fastnodeAssetsImport } from "../../src/build/builders/vite/_assets.ts";
import type { FastnodePluginContext } from "../../src/build/builders/vite/types.ts";

vi.mock("@hiogawa/vite-plugin-fullstack/assets", () => ({
  default: () => [null, { name: "fullstack:test", transform: () => "export const value = 1" }],
}));

describe("fastnodeAssetsImport", () => {
  it("ignores falsy plugins returned by the fullstack assets plugin", () => {
    const plugins = fastnodeAssetsImport({} as FastnodePluginContext);
    expect(plugins).toHaveLength(1);
    expect(plugins[0]!.name).toBe("fullstack:test");
  });
});
