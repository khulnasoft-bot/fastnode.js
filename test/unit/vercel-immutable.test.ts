import { describe, expect, it, vi } from "vitest";
import type { Fastnode } from "fastnode/types";
import { setupImmutableStaticFiles } from "../../src/presets/vercel/immutable.ts";

function createFastnode(options: { baseURL: string; immutableStaticFiles?: boolean }) {
  const warn = vi.fn();
  const fastnode = {
    options: {
      baseURL: options.baseURL,
      framework: { name: "fastnode" },
      vercel: { immutableStaticFiles: options.immutableStaticFiles ?? true },
    },
    logger: { withTag: () => ({ warn, info: vi.fn() }) },
  } as unknown as Fastnode;
  return { fastnode, warn };
}

describe("vercel: setupImmutableStaticFiles", () => {
  it("sets buildAssetsDir for a root baseURL", () => {
    const { fastnode, warn } = createFastnode({ baseURL: "/" });
    setupImmutableStaticFiles(fastnode);
    expect(fastnode.options.buildAssetsDir).toBe("_vercel/immutable/fastnode");
    expect(fastnode.options.vercel!.immutableStaticFiles).toBe(true);
    expect(warn).not.toHaveBeenCalled();
  });

  it("disables and warns for a non-root baseURL", () => {
    const { fastnode, warn } = createFastnode({ baseURL: "/app/" });
    setupImmutableStaticFiles(fastnode);
    expect(fastnode.options.vercel!.immutableStaticFiles).toBe(false);
    expect(fastnode.options.buildAssetsDir).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("non-root `baseURL`"));
  });

  it("is a no-op when not enabled", () => {
    const { fastnode, warn } = createFastnode({ baseURL: "/app/", immutableStaticFiles: false });
    setupImmutableStaticFiles(fastnode);
    expect(fastnode.options.buildAssetsDir).toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
  });
});
