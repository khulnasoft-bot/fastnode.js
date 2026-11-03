import { glob } from "tinyglobby";
import { resolve } from "pathe";
import { joinURL, withLeadingSlash } from "ufo";
import { provider } from "std-env";
import type { Fastnode } from "fastnode/types";
import { writeFile } from "../_utils/fs.ts";

// Immutable Static Files
//
// https://vercel.com/docs/build-output-api/primitives
//
// Immutable static files are content-addressed and shared across deployments which improves cross-deployment
// caching.
//
// Newer deployments must never overwrite an existing file with different content, so the file names embed a content hash.
//
// Alongside `.vercel/output/static`, we emit a `.vercel/output/immutable.json`
// manifest mapping each immutable static file URL to its full content hash. The
// spec allows using the file path itself as the "full content hash" when the
// name already carries enough entropy, which is what we do: emitted file names
// embed a 16 character content hash (see `useLongerAssetHashes`).

const IMMUTABLE_MANIFEST = "immutable.json";

interface ImmutableManifest {
  version: 1;
  hashes: Record<string, string>;
}

// Opt-in guard for immutable static files, run from `build:before`.
//
// Immutable static files are opt-in via `vercel.immutableStaticFiles` (defaulting
// to the `FASTNODE_VERCEL_IMMUTABLE_STATIC_FILES_ENABLED` env var). When running on
// Vercel, the platform advertises support through `VERCEL_IMMUTABLE_STATIC_FILES_ENABLED`.
// If the feature is enabled but the current deployment does not support it, or the
// app is served from a non-root `baseURL`, an immutable deploy would fail or silently
// not apply, so we disable it and warn instead of producing broken output.
export function setupImmutableStaticFiles(fastnode: Fastnode) {
  if (!fastnode.options.vercel?.immutableStaticFiles) {
    return;
  }

  if (provider === "vercel" && !process.env.VERCEL_IMMUTABLE_STATIC_FILES_ENABLED) {
    fastnode.options.vercel.immutableStaticFiles = false;
    fastnode.logger
      .withTag("vercel")
      .warn(
        "Immutable static files are enabled but not supported by the current Vercel deployment (`VERCEL_IMMUTABLE_STATIC_FILES_ENABLED` is not set). Skipping immutable static files output."
      );
    return;
  }

  // `publicDir` is nested under `baseURL`, so a non-root base would emit assets
  // to `/<base>/_vercel/immutable/...` instead of the reserved `/_vercel/immutable/`
  // namespace. Vercel would not treat those as immutable, so opt out instead.
  if (fastnode.options.baseURL !== "/") {
    fastnode.options.vercel.immutableStaticFiles = false;
    fastnode.logger
      .withTag("vercel")
      .warn(
        `Immutable static files are not supported with a non-root \`baseURL\` (\`${fastnode.options.baseURL}\`), since they must be served from the reserved \`/_vercel/immutable/\` path. Skipping immutable static files output.`
      );
    return;
  }

  fastnode.options.buildAssetsDir = immutableDir(fastnode);
}

export async function generateImmutableManifest(fastnode: Fastnode) {
  // Skip unless immutable static files are enabled (`vercel.immutableStaticFiles`).
  if (!fastnode.options.vercel?.immutableStaticFiles) {
    return;
  }

  const publicDir = fastnode.options.output.publicDir;
  const files = await glob(`${fastnode.options.buildAssetsDir}/**`, {
    cwd: publicDir,
    absolute: false,
    dot: true,
  });

  const manifest: ImmutableManifest = {
    version: 1,
    hashes: Object.fromEntries(
      files.map((file) => {
        const pathname = withLeadingSlash(file);
        const url = joinURL(fastnode.options.baseURL, pathname);
        return [url, url];
      })
    ),
  };

  await writeFile(
    resolve(fastnode.options.output.dir, IMMUTABLE_MANIFEST),
    JSON.stringify(manifest, null, 2)
  );

  const logger = fastnode.logger.withTag("vercel");
  if (files.length === 0) {
    // Emitting no immutable files almost always means the client build did not
    // pick up `buildAssetsDir` (only the Fastnode + Vite integration wires it up
    // automatically). Warn instead of silently writing an empty manifest.
    logger.warn(
      `Immutable static files are enabled but no assets were emitted under \`${fastnode.options.buildAssetsDir}\`. Make sure your client build uses \`fastnode.options.buildAssetsDir\` as its assets directory.`
    );
  } else {
    logger.info(`Generated immutable manifest (${files.length} files).`);
  }
}

// Reserved Vercel namespace under which immutable static files are served.
// Used as the client `buildAssetsDir` so content-addressed assets are emitted
// and referenced here. The path is namespaced by an optional hash salt and the
// framework name to avoid cross-framework collisions.
export function immutableDir(fastnode: Fastnode) {
  return normalizeBuildAssetsDir(
    joinURL(
      "_vercel/immutable",
      process.env.VERCEL_HASH_SALT || "",
      fastnode.options.framework.name || ""
    )
  );
}

// Normalize a build assets directory into a bare relative path, stripping
// leading, trailing and duplicate slashes as well as `.` / `..` segments (a
// hand-set `VERCEL_HASH_SALT` must not escape the reserved namespace).
// Mirrors the same normalization applied to user config in `resolveURLOptions`.
function normalizeBuildAssetsDir(dir: string): string {
  return dir
    .split("/")
    .filter((segment) => segment && segment !== "." && segment !== "..")
    .join("/");
}
