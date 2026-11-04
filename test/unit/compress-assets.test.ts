import { existsSync } from "node:fs";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import zlib from "node:zlib";
import { join } from "pathe";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { build, createFastnode, prepare, prerender } from "../../src/builder.ts";
import type { Fastnode, FastnodeConfig } from "fastnode/types";

// The vite builder loads `fastnode/vite` from `dist/`, so it would not use the sources here
const builders = ["rolldown", "rollup"] as const;

describe("compressPublicAssets", () => {
  let rootDir: string;

  beforeEach(async () => {
    rootDir = await realpath(await mkdtemp(join(tmpdir(), "fastnode-compress-")));
    await writeFile(join(rootDir, "package.json"), JSON.stringify({ type: "module" }));
    await writeFile(
      join(rootDir, "server.ts"),
      `export default { fetch: () => new Response("ok") };`
    );
  });

  afterEach(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  async function createProject(config: FastnodeConfig = {}) {
    const fastnode = await createFastnode({
      rootDir,
      preset: "node-server",
      compatibilityDate: "2025-01-01",
      logLevel: 0,
      compressPublicAssets: true,
      ...config,
    });
    fastnode.hooks.hook("close", () =>
      writeFile(join(fastnode.options.output.publicDir, "late.txt"), "x".repeat(2048))
    );
    return fastnode;
  }

  async function buildProject(fastnode: Fastnode) {
    try {
      await prepare(fastnode);
      await mkdir(fastnode.options.output.publicDir, { recursive: true });
      await build(fastnode);
    } finally {
      await fastnode.close();
    }
  }

  for (const builder of builders) {
    it(`compresses public assets written by \`close\` hooks (${builder})`, async () => {
      const fastnode = await createProject({ builder });
      await buildProject(fastnode);
      const publicDir = fastnode.options.output.publicDir;
      expect(existsSync(join(publicDir, "late.txt.gz"))).toBe(true);
      expect(existsSync(join(publicDir, "late.txt.br"))).toBe(true);
      if (zlib.zstdCompress !== undefined) {
        expect(existsSync(join(publicDir, "late.txt.zst"))).toBe(true);
      }
    });
  }

  it("does not compress when `compressPublicAssets` is disabled", async () => {
    const fastnode = await createProject({ builder: "rolldown", compressPublicAssets: false });
    await buildProject(fastnode);
    expect(existsSync(join(fastnode.options.output.publicDir, "late.txt.gz"))).toBe(false);
  });

  it("does not compress when closing without a build", async () => {
    const fastnode = await createProject();
    await mkdir(fastnode.options.output.publicDir, { recursive: true });
    await fastnode.close();
    expect(existsSync(join(fastnode.options.output.publicDir, "late.txt"))).toBe(true);
    expect(existsSync(join(fastnode.options.output.publicDir, "late.txt.gz"))).toBe(false);
  });

  it("does not compress from the prerenderer", async () => {
    let compressedDuringPrerender: boolean | undefined;
    const fastnode = await createProject({
      builder: "rolldown",
      prerender: { routes: ["/"] },
      hooks: {
        "prerender:init": (prerenderer) =>
          writeFile(join(prerenderer.options.output.publicDir, "early.txt"), "x".repeat(2048)),
        "prerender:done": () => {
          compressedDuringPrerender = existsSync(
            join(fastnode.options.output.publicDir, "early.txt.gz")
          );
        },
      },
    });
    try {
      await prepare(fastnode);
      await mkdir(fastnode.options.output.publicDir, { recursive: true });
      await prerender(fastnode);
    } finally {
      await fastnode.close();
    }
    expect(compressedDuringPrerender).toBe(false);
    expect(existsSync(join(fastnode.options.output.publicDir, "early.txt.gz"))).toBe(true);
  });
});
