import type { Fastnode, FastnodeBuildPlugin, FastnodeBuildPluginOption } from "fastnode/types";
import type { Plugin } from "rollup";
import type { BaseBuildConfig } from "./config.ts";
import type { ExternalsTraceOptions } from "nf3";

import { virtualTemplates } from "./virtual/_all.ts";
import { unwasm } from "unwasm/plugin";
import { routeMeta } from "./plugins/route-meta.ts";
import { serverMain } from "./plugins/server-main.ts";
import { virtual, virtualDeps } from "./plugins/virtual.ts";
import { sourcemap } from "./plugins/sourcemap.ts";
import { raw } from "./plugins/raw.ts";
import { replace } from "./plugins/replace.ts";
import { importAttributes } from "./plugins/import-attributes.ts";
import { externals } from "./plugins/externals.ts";
import { unenv } from "./plugins/unenv.ts";
import { runtimeDeps } from "./plugins/runtime-deps.ts";
import { tsconfigPaths } from "./plugins/tsconfig-paths.ts";

export async function baseBuildPlugins(fastnode: Fastnode, base: BaseBuildConfig) {
  const plugins: Plugin[] = [];

  // Virtual
  const virtualPlugin = virtual(virtualTemplates(fastnode, [...base.env.polyfills]));
  fastnode.vfs = virtualPlugin.api.modules;
  plugins.push(virtualPlugin, virtualDeps());

  // TypeScript `paths`
  const tsconfigPathsPlugin = tsconfigPaths(fastnode, base.aliases);
  if (tsconfigPathsPlugin) {
    plugins.push(tsconfigPathsPlugin);
  }

  // Node.js compatibility polyfills (resolved on demand)
  plugins.push(unenv(fastnode, base.env));

  // Optional runtime dependencies (`unstorage`, `db0`) imported by Fastnode (resolved on demand)
  plugins.push(runtimeDeps(fastnode));

  // WASM loader
  if (fastnode.options.wasm !== false) {
    plugins.push(unwasm(fastnode.options.wasm || {}));
  }

  // Inject globalThis.__server_main__
  plugins.push(serverMain(fastnode));

  // Raw Imports
  plugins.push(await importAttributes(fastnode), raw());

  // Route meta
  if (fastnode.options.experimental.openAPI) {
    plugins.push(await routeMeta(fastnode));
  }

  // Replace
  plugins.push(replace(base.replacements));

  // Externals (require Node.js compatible resolution)
  if (fastnode.options.node && fastnode.options.noExternals !== true) {
    const isDevOrPrerender =
      fastnode.options.dev || fastnode.options.preset === "fastnode-prerender";
    plugins.push(
      externals({
        rootDir: fastnode.options.rootDir,
        conditions: fastnode.options.exportConditions!,
        include: fastnode.options.traceDeps || [],
        exclude: [...base.noExternal],
        trace: isDevOrPrerender
          ? false
          : {
              // `fastnode/types` has its own bundled copy of the `nf3` types
              ...(fastnode.options.traceOpts as Partial<ExternalsTraceOptions>),
              outDir: fastnode.options.output.serverDir,
            },
      })
    );
  }

  // Sourcemap
  if (fastnode.options.sourcemap && !fastnode.options.dev) {
    plugins.push(
      sourcemap({
        virtualIds: virtualPlugin.api.modules.keys(),
        minify: fastnode.options.experimental.sourcemapMinify !== false,
      })
    );
  }

  return plugins;
}

/** Fastnode's `plugins` wrapped with the `buildPlugins` (ordered by `enforce`). */
export async function withBuildPlugins<T>(fastnode: Fastnode, plugins: T[]): Promise<T[]> {
  const buildPlugins = await resolveBuildPlugins(fastnode);
  const byEnforce = (enforce?: "pre" | "post") =>
    buildPlugins.filter((p) => p.enforce === enforce) as T[];
  return [...byEnforce("pre"), ...plugins, ...byEnforce(), ...byEnforce("post")];
}

/** Flattened `buildPlugins` (nested arrays and promises resolved, falsy entries skipped). */
export async function resolveBuildPlugins(fastnode: Fastnode): Promise<FastnodeBuildPlugin[]> {
  return flatPlugins(fastnode.options.buildPlugins || []);
}

async function flatPlugins(options: FastnodeBuildPluginOption[]): Promise<FastnodeBuildPlugin[]> {
  const plugins: FastnodeBuildPlugin[] = [];
  for (const entry of options) {
    const option = await entry;
    if (Array.isArray(option)) {
      plugins.push(...(await flatPlugins(option)));
    } else if (option) {
      plugins.push(option);
    }
  }
  return plugins;
}
