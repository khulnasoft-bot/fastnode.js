import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { readFile, rm, mkdir } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import { createFastnode, build, prepare } from "fastnode/builder";
import type { FastnodeBuildInfo } from "fastnode/types";

const fixtureDir = fileURLToPath(new URL("./static-preset-fixture", import.meta.url));
const tmpDir = fileURLToPath(new URL("./static-preset-fixture/.tmp", import.meta.url));

const presets = {
  static: "public",
  "github-pages": "public",
  // "gitlab-pages": "public",
  "vercel-static": "static",
  "cloudflare-pages-static": ".",
};

describe.each(Object.entries(presets))("static preset (%s)", (preset, publicDir) => {
  const outDir = join(tmpDir, preset);
  let serverDir: string;

  beforeAll(async () => {
    await rm(outDir, { recursive: true, force: true });
    await mkdir(outDir, { recursive: true });
    const fastnode = await createFastnode({
      rootDir: fixtureDir,
      preset,
      output: { dir: outDir },
      builder: "vite",
    });
    serverDir = fastnode.options.output.serverDir;
    try {
      await prepare(fastnode);
      await build(fastnode);
    } finally {
      await fastnode.close();
    }
  }, 30_000);

  it("does not emit a server bundle", async () => {
    expect(existsSync(serverDir)).toBe(false);
    const buildInfo = JSON.parse(
      await readFile(join(outDir, "fastnode.json"), "utf8")
    ) as FastnodeBuildInfo;
    expect(buildInfo.serverEntry).toBeUndefined();
  });

  it("prerenders routes to the public dir", async () => {
    const html = await readFile(join(outDir, publicDir, "index.html"), "utf8");
    expect(html).toContain("<h1>prerendered</h1>");
  });
});
