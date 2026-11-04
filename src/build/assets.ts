import { existsSync, promises as fsp } from "node:fs";
import { glob } from "tinyglobby";
import { isDirectory, prettyPath } from "../utils/fs.ts";
import type { Fastnode, FastnodeOptions } from "fastnode/types";
import { join, relative, resolve } from "pathe";
import { compressPublicAssets } from "../utils/compress.ts";

const NEGATION_RE = /^(!?)(.*)$/;
const PARENT_DIR_GLOB_RE = /!?\.\.\//;

export async function scanUnprefixedPublicAssets(fastnode: Fastnode) {
  const scannedPaths: string[] = [];
  for (const asset of fastnode.options.publicAssets) {
    if (asset.baseURL && asset.baseURL !== "/" && !asset.fallthrough) {
      // we can statically detect these without scanning
      continue;
    }
    const publicAssets = await globPublicAssets(fastnode, asset);
    scannedPaths.push(...publicAssets.map((file) => join(asset.baseURL || "/", file)));
  }
  return scannedPaths;
}

export async function copyPublicAssets(fastnode: Fastnode) {
  if (fastnode.options.noPublicDir) {
    return;
  }
  for (const asset of fastnode.options.publicAssets) {
    const dstDir = join(fastnode.options.output.publicDir, asset.baseURL!);
    const publicAssets = await globPublicAssets(fastnode, asset);
    await Promise.all(
      publicAssets.map(async (file) => {
        const src = join(asset.dir, file);
        const dst = join(dstDir, file);
        if (!existsSync(dst)) {
          await fsp.cp(src, dst);
        }
      })
    );
  }
  if (fastnode.options.compressPublicAssets) {
    await compressPublicAssets(fastnode);
  }
  fastnode.logger.success("Generated public " + prettyPath(fastnode.options.output.publicDir));
}

/** Files of a public asset directory (relative paths), without the ignored ones. */
export async function globPublicAssets(
  fastnode: Fastnode,
  asset: FastnodeOptions["publicAssets"][number]
): Promise<string[]> {
  if (!(await isDirectory(asset.dir))) {
    return [];
  }
  return glob(getIncludePatterns(fastnode, asset.dir, asset.ignore), {
    cwd: asset.dir,
    absolute: false,
    dot: true,
  });
}

function getIncludePatterns(
  fastnode: Fastnode,
  assetDir: string,
  ignorePatterns: string[] | false = fastnode.options.ignore
) {
  return [
    "**",
    ...(ignorePatterns || []).map((p) => {
      const match = p.match(NEGATION_RE);
      const [_, negation, pattern] = match || [];
      return (
        // Convert ignore to include patterns
        (negation ? "" : "!") +
        // Make non-glob patterns relative to publicAssetDir
        (pattern!.startsWith("*")
          ? pattern!
          : relative(assetDir, resolve(fastnode.options.rootDir, pattern!)))
      );
    }),
  ].filter((p) => !PARENT_DIR_GLOB_RE.test(p));
}
