import { describe, expect, it, vi } from "vitest";
import type { FastnodeOptions } from "fastnode/types";
import { resolveKVOptions } from "../../src/config/resolver/kv.ts";
import { resolveKVMounts } from "../../src/utils/storage.ts";

const warn = vi.hoisted(() => vi.fn());
vi.mock("consola", () => ({ default: { warn } }));

function createOptions(options: Partial<FastnodeOptions>): FastnodeOptions {
  return { rootDir: process.cwd(), kv: {}, devStorage: {}, ...options } as FastnodeOptions;
}

describe("resolveKVOptions", () => {
  it("merges deprecated `storage` into `kv`", async () => {
    warn.mockClear();
    const options = createOptions({
      kv: { data: { driver: "memory" } },
      storage: { legacy: { driver: "memory" }, data: { driver: "fs" } },
    });
    await resolveKVOptions(options);
    expect(options.kv).toEqual({ legacy: { driver: "memory" }, data: { driver: "memory" } });
    expect(options.storage).toBe(options.kv);
    expect(warn).toHaveBeenCalledOnce();
  });

  it.each<Partial<FastnodeOptions>>([{ dev: true }, { preset: "fastnode-prerender" }])(
    "still applies deprecated `devStorage` (%o)",
    async (env) => {
      warn.mockClear();
      const options = createOptions({
        ...env,
        kv: { data: { driver: "redis", host: "prod.example.com" } },
        devStorage: { data: { driver: "memory" } },
      });
      await resolveKVOptions(options);
      expect(warn).toHaveBeenCalledOnce();
      expect(resolveKVMounts(options)).toMatchObject([{ name: "memory", options: {} }]);
    }
  );

  it("does not warn when only `kv` is used", async () => {
    warn.mockClear();
    const options = createOptions({ kv: { data: { driver: "memory" } } });
    await resolveKVOptions(options);
    expect(options.storage).toBe(options.kv);
    expect(warn).not.toHaveBeenCalled();
  });
});
