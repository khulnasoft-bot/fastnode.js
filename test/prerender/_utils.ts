import { mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "pathe";
import { build, copyPublicAssets, createFastnode, prepare, prerender } from "fastnode/builder";
import type { LoadConfigOptions } from "fastnode/types";

const tmpDir = fileURLToPath(new URL("./.tmp", import.meta.url));

export async function prerenderFixture(name: string, opts?: LoadConfigOptions) {
  const outDir = join(tmpDir, name);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const fastnode = await createFastnode(
    {
      rootDir: fileURLToPath(new URL(`./${name}`, import.meta.url)),
      preset: "static",
      output: { dir: outDir },
      prerender: { crawlLinks: false, routes: ["/"] },
    },
    opts
  );

  try {
    await prepare(fastnode);
    await copyPublicAssets(fastnode);
    await prerender(fastnode);
    await build(fastnode);
  } finally {
    await fastnode.close();
  }

  return { fastnode, outDir };
}

export async function cleanupFixtures(names: string[]) {
  await Promise.all(names.map((name) => rm(join(tmpDir, name), { recursive: true, force: true })));
}
