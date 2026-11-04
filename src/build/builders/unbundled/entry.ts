import type { Fastnode } from "fastnode/types";

import { pathToFileURL } from "node:url";
import { resolveModulePath } from "exsolve";
import { pkgDir } from "#fastnode/meta";
import { join, resolve } from "pathe";
import { baseBuildConfig } from "../../config.ts";
import { virtualTemplates } from "../../virtual/_all.ts";

export const FASTNODE_VIRTUAL_PREFIX = "#fastnode/virtual/";

export interface UnbundledApp {
  /** Path of the (virtual) entry the runner loads. */
  entry: string;
  /** Virtual modules for the runner (`data.virtual`). */
  virtual: Record<string, string>;
  /** File URL of the app entry the entry re-exports. */
  appEntry: string;
}

/**
 * Prepare the entry and virtual modules to run the server sources without a builder.
 *
 * `#fastnode/virtual/*` modules are keyed by the file path the Fastnode package maps them to
 * (`dist/runtime/virtual/*.mjs`), so env-runner serves them as that file and their imports
 * (`#fastnode/runtime/*`, runtime dependencies) resolve from the Fastnode package, like real files.
 * Each of them has a stub file there, so runtimes resolve `#fastnode/virtual/*` natively.
 *
 * Also exposes the rendered virtual templates as `fastnode.vfs` for the `/_vfs` debug endpoint
 * (and synchronous raw imports of them).
 */
export async function prepareUnbundledApp(fastnode: Fastnode): Promise<UnbundledApp> {
  const { env, extensions } = await baseBuildConfig(fastnode);

  // Rendered once (some templates read files), so the runner and `fastnode.vfs` see the same sources
  const rendered = await Promise.all(
    virtualTemplates(fastnode, [...env.polyfills]).map(
      async (t) =>
        [t.id, typeof t.template === "function" ? await t.template() : t.template] as const
    )
  );
  fastnode.vfs = new Map(rendered.map(([id, code]) => [id, { render: () => code }]));

  const virtual: Record<string, string> = Object.fromEntries(
    rendered.map(([id, code]) => [
      id.startsWith(FASTNODE_VIRTUAL_PREFIX) ? fastnodeVirtualPath(id) : id,
      code,
    ])
  );

  const entry = resolve(fastnode.options.output.serverDir, "index.mjs");
  const appEntry = pathToFileURL(
    resolveModulePath(fastnode.options.entry, { from: fastnode.options.rootDir, extensions })
  ).href;
  virtual[entry] = /* js */ `
globalThis.__fastnode_main__ = import.meta.url;
export * from ${JSON.stringify(appEntry)};
export { default } from ${JSON.stringify(appEntry)};
`.trimStart();

  return { entry, virtual, appEntry };
}

/**
 * File path the Fastnode package maps a `#fastnode/virtual/*` id to (`dist/runtime/virtual/*.mjs`).
 *
 * Without an id, the directory of these files.
 */
export function fastnodeVirtualPath(id: string): string {
  const dir = join(pkgDir, "dist/runtime/virtual/");
  return id ? join(dir, `${id.slice(FASTNODE_VIRTUAL_PREFIX.length)}.mjs`) : dir;
}
