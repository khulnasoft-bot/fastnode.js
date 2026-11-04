import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { rm, mkdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { createFastnode, build, prepare } from "fastnode/builder";
import { getBundlerConfig } from "../../src/build/builders/vite/bundler.ts";
import type { FastnodePluginContext } from "../../src/build/builders/vite/types.ts";

const fixtureDir = fileURLToPath(new URL("./build-plugins-fixture", import.meta.url));
const tmpDir = fileURLToPath(new URL("./build-plugins-fixture/.tmp", import.meta.url));

describe("buildPlugins", () => {
  for (const builder of ["rolldown", "rollup", "vite"] as const) {
    describe(builder, () => {
      let outDir: string;

      it("build", async () => {
        outDir = join(tmpDir, builder);
        await rm(outDir, { recursive: true, force: true });
        await mkdir(outDir, { recursive: true });
        const fastnode = await createFastnode({
          rootDir: fixtureDir,
          output: { dir: outDir },
          builder,
          // @ts-expect-error for testing
          __vitePkg__: process.env.FASTNODE_VITE_PKG,
        });
        await prepare(fastnode);
        await build(fastnode);
        await fastnode.close();
      });

      it("applies plugins from config, promises and modules, ordered by `enforce`", async () => {
        const entry = join(outDir, "server/index.mjs");
        const { fetch } = await import(entry).then((m) => m.default);
        const res = await fetch(new Request("http://localhost/"));
        expect(await res.json()).toEqual({
          // `pre` plugins run before Fastnode's virtual modules, the others after them
          pre: "pre",
          normal: "fastnode",
          post: "fastnode",
          module: "module",
          promise: "promise",
        });
      });
    });
  }

  // Vite on Rollup (Vite 7) adds the Rollup-only plugins in its own merge
  it("places `pre` plugins before the Rollup-only plugins with Vite on Rollup", async () => {
    const fastnode = await createFastnode({ rootDir: fixtureDir, builder: "vite" });
    const { rollupConfig } = await getBundlerConfig({
      fastnode,
      _isRolldown: false,
    } as FastnodePluginContext);
    const names = (rollupConfig!.plugins as { name: string }[]).map((p) => p.name);
    expect(names.slice(0, 3)).toEqual(["fixture:pre", "inject", "alias"]);
    expect(names.at(-1)).toBe("fixture:post");
    await fastnode.close();
  });
});
