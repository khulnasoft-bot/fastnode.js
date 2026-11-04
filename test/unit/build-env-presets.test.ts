import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import type { Fastnode, FastnodeConfig } from "fastnode/types";
import { createFastnode } from "../../src/builder.ts";
import { resolveBuildEnv } from "../../src/build/env.ts";

const rootDir = fileURLToPath(new URL("../fixture", import.meta.url));

async function setup(config: FastnodeConfig, setupFastnode?: (fastnode: Fastnode) => void) {
  const fastnode = await createFastnode({
    rootDir,
    compatibilityDate: "2025-01-01",
    logLevel: 0,
    ...config,
  });
  setupFastnode?.(fastnode);
  await fastnode.hooks.callHook("build:before", fastnode);
  const env = await resolveBuildEnv(fastnode);
  await fastnode.close();
  return { fastnode, env };
}

describe("build env precedence with presets", () => {
  it.each(["netlify-edge"])(
    "%s does not expose builtin aliases to path resolution",
    async (preset) => {
      const { fastnode, env } = await setup({ preset, plugins: ["utils/plugin.ts", "events.ts"] });
      expect(fastnode.options.plugins).toContain(`${rootDir}/utils/plugin.ts`);
      expect(fastnode.options.plugins).toContain(`${rootDir}/events.ts`);
      expect(fastnode.options.alias.events).toBeUndefined();
      expect(env.alias.events).toBe("node:events");
      expect(env.external).toContain("node:fs");
      expect(env.external.filter((id) => id.startsWith("node:node:"))).toEqual([]);
    }
  );

  it("legacy `unenv` config overrides preset entries", async () => {
    const { env } = await setup({
      preset: "netlify-edge",
      unenv: { alias: { "node:fs": "/legacy/fs" }, inject: { process: "/legacy/process" } },
    });
    expect(env.alias["node:fs"]).toBe("/legacy/fs");
    expect(env.inject.process).toBe("/legacy/process");
  });

  it("legacy presets pushed from hooks override preset entries", async () => {
    const { env } = await setup({ preset: "cloudflare-module" }, (fastnode) => {
      fastnode.hooks.hook("build:before", () => {
        fastnode.options.unenv.push({
          alias: { "node:fs": "/hook/fs" },
          inject: { Buffer: "/hook/buffer" },
        });
      });
    });
    expect(env.alias["node:fs"]).toBe("/hook/fs");
    expect(env.inject.Buffer).toBe("/hook/buffer");
    expect(env.external).toContain("cloudflare:workers");
    expect(env.external).toContain("node:fs");
  });

  it("user options override preset and legacy entries", async () => {
    const { env } = await setup({
      preset: "cloudflare-module",
      alias: { "node:fs": "/user/fs" },
      inject: { Buffer: false },
      unenv: { alias: { "node:fs": "/legacy/fs" } },
    });
    expect(env.alias["node:fs"]).toBe("/user/fs");
    expect(env.inject.Buffer).toBeUndefined();
  });
});
