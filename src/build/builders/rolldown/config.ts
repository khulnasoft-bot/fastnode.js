import type { Fastnode, RolldownConfig } from "fastnode/types";
import type { OutputOptions, RolldownOptions, RolldownPlugin } from "rolldown";
import { baseBuildConfig } from "../../config.ts";
import { baseBuildPlugins, withBuildPlugins } from "../../plugins.ts";
import { assetUrls } from "../../plugins/asset-urls.ts";
import { excludeSourcemapSources } from "../../plugins/sourcemap.ts";
import { defu } from "defu";
import { getChunkName, libChunksGroup } from "../../chunks.ts";
import { builtinExternals, builtins } from "../../plugins/builtins.ts";

export const getRolldownConfig = async (fastnode: Fastnode): Promise<RolldownConfig> => {
  const base = await baseBuildConfig(fastnode);

  const tsc = fastnode.options.typescript.tsConfig?.compilerOptions;

  let config: RolldownOptions = {
    platform: fastnode.options.node ? "node" : "neutral",
    cwd: fastnode.options.rootDir,
    input: fastnode.options.entry,
    // Fastnode resolves `tsconfig` and passes relevant options (e.g. `transform.jsx`) explicitly.
    // Disable Rolldown's own tsconfig discovery to avoid `CONFIGURATION_FIELD_CONFLICT` warnings
    // and keep behavior consistent with the Rollup builder.
    tsconfig: false,
    // Rolldown checks `external` before aliases and plugins: builtins aliased to polyfills are
    // bundled, and the ones aliased to another id (all of them without the node platform) are
    // left to `fastnode:builtins`
    external: fastnode.options.node
      ? [
          ...base.env.external,
          ...builtins.filter((id) => !base.env.alias[id] || base.env.alias[id] === id),
        ]
      : [],
    plugins: await withBuildPlugins(fastnode, [
      builtinExternals(base.env, { node: fastnode.options.node }),
      ...((await baseBuildPlugins(fastnode, base)) as RolldownPlugin[]),
      // Emitted files are read from the filesystem, which worker runtimes do not have
      fastnode.options.node && ((await assetUrls(fastnode)) as RolldownPlugin),
    ]),
    resolve: {
      alias: base.aliases,
      extensions: base.extensions,
      conditionNames: fastnode.options.exportConditions,
    },
    transform: {
      inject: base.env.inject as Record<string, string>,
      jsx: {
        runtime: tsc?.jsx === "react" ? "classic" : "automatic",
        pragma: tsc?.jsxFactory,
        pragmaFrag: tsc?.jsxFragmentFactory,
        importSource: tsc?.jsxImportSource,
        development: fastnode.options.dev,
      },
    },
    onwarn(warning, warn) {
      if (!base.ignoreWarningCodes.has(warning.code || "")) {
        warn(warning);
      }
    },
    optimization: {
      inlineConst: true,
    },
    output: {
      format: "esm",
      entryFileNames: "index.mjs",
      minifyInternalExports: false,
      chunkFileNames: (chunk) => getChunkName(chunk, fastnode),
      codeSplitting: {
        groups: [libChunksGroup(fastnode)],
      },
      dir: fastnode.options.output.serverDir,
      inlineDynamicImports: fastnode.options.inlineDynamicImports,
      // https://github.com/rolldown/rolldown/issues/7235
      minify: fastnode.options.minify ? true : "dce-only",
      sourcemap: fastnode.options.sourcemap,
      // fastnode:sourcemap removes `sourcesContent` from production maps, so don't generate it
      sourcemapExcludeSources: excludeSourcemapSources(fastnode),
      sourcemapIgnoreList(relativePath) {
        return relativePath.includes("node_modules");
      },
    },
  } satisfies RolldownOptions;

  config = defu(
    fastnode.options.rolldownConfig as RolldownOptions,
    fastnode.options.rollupConfig as RolldownOptions,
    config
  );

  const outputConfig = config.output as OutputOptions;
  if (outputConfig.inlineDynamicImports || outputConfig.format === "iife") {
    outputConfig.codeSplitting = false;
  }
  // `inlineDynamicImports` is deprecated in favor of `codeSplitting: false`
  delete outputConfig.inlineDynamicImports;

  return config as RolldownConfig;
};
