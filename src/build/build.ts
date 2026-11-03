import type { Fastnode } from "fastnode/types";
import { existsSync } from "node:fs";
import { compressPublicAssets } from "../utils/compress.ts";

export async function build(fastnode: Fastnode) {
  if (!fastnode.options.dev && fastnode.options.compressPublicAssets) {
    fastnode.hooks.hookOnce("close", async () => {
      if (existsSync(fastnode.options.output.publicDir)) {
        await compressPublicAssets(fastnode);
      }
    });
  }
  switch (fastnode.options.builder) {
    case "rollup": {
      const { rollupBuild } = await import("./rollup/build.ts");
      return rollupBuild(fastnode);
    }
    case "rolldown": {
      const { rolldownBuild } = await import("./rolldown/build.ts");
      return rolldownBuild(fastnode);
    }
    case "vite": {
      const { viteBuild } = await import("./vite/build.ts");
      return viteBuild(fastnode);
    }
    case false: {
      const { unbundledBuild } = await import("./unbundled/build.ts");
      return unbundledBuild(fastnode);
    }
    default: {
      throw new Error(`Unknown builder: ${fastnode.options.builder}`);
    }
  }
}
