import type { Fastnode, RollupConfig } from "fastnode/types";
import { defu } from "defu";
import alias from "@rollup/plugin-alias";
import commonjs from "@rollup/plugin-commonjs";
import inject from "@rollup/plugin-inject";
import json from "@rollup/plugin-json";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import { oxc } from "../../plugins/oxc.ts";
import { assetUrls } from "../../plugins/asset-urls.ts";
import { baseBuildConfig } from "../../config.ts";
import { baseBuildPlugins, withBuildPlugins } from "../../plugins.ts";
import { getChunkName, libChunkName, NODE_MODULES_RE } from "../../chunks.ts";

export const getRollupConfig = async (fastnode: Fastnode): Promise<RollupConfig> => {
  const base = await baseBuildConfig(fastnode);

  const tsc = fastnode.options.typescript.tsConfig?.compilerOptions;

  let config: RollupConfig = {
    input: fastnode.options.entry,
    external: [...base.env.external],
    plugins: await withBuildPlugins(fastnode, [
      ...(await baseBuildPlugins(fastnode, base)),
      await oxc(fastnode, {
        sourcemap: !!fastnode.options.sourcemap,
        minify: fastnode.options.minify ? { ...fastnode.options.oxc?.minify } : false,
        transform: {
          target: "esnext",
          cwd: fastnode.options.rootDir,
          ...fastnode.options.oxc?.transform,
          jsx: {
            runtime: tsc?.jsx === "react" ? "classic" : "automatic",
            pragma: tsc?.jsxFactory,
            pragmaFrag: tsc?.jsxFragmentFactory,
            importSource: tsc?.jsxImportSource,
            development: fastnode.options.dev,
            ...fastnode.options.oxc?.transform?.jsx,
          },
        },
      }),
      alias({ entries: base.aliases }),
      nodeResolve({
        extensions: base.extensions,
        preferBuiltins: !!fastnode.options.node,
        rootDir: fastnode.options.rootDir,
        exportConditions: fastnode.options.exportConditions,
      }),
      (commonjs as unknown as typeof commonjs.default)({
        ...fastnode.options.commonJS,
      }),
      (json as unknown as typeof json.default)(),
      (inject as unknown as typeof inject.default)(base.env.inject),
      // Emitted files are read from the filesystem, which worker runtimes do not have
      fastnode.options.node && (await assetUrls(fastnode)),
    ]),
    onwarn(warning, rollupWarn) {
      if (!base.ignoreWarningCodes.has(warning.code || "")) {
        rollupWarn(warning);
      }
    },
    output: {
      format: "esm",
      // `assert` was removed in Node.js v22; Rollup 5 defaults to `with` (rollup/rollup#6248).
      importAttributesKey: "with",
      entryFileNames: "index.mjs",
      chunkFileNames: (chunk) => getChunkName(chunk, fastnode),
      dir: fastnode.options.output.serverDir,
      inlineDynamicImports: fastnode.options.inlineDynamicImports,
      generatedCode: { constBindings: true },
      sourcemap: fastnode.options.sourcemap,
      sourcemapExcludeSources: true,
      sourcemapIgnoreList: (id) => id.includes("node_modules"),
      manualChunks(id: string) {
        if (NODE_MODULES_RE.test(id)) {
          return libChunkName(id);
        }
        return undefined;
      },
    },
  } satisfies RollupConfig;

  config = defu(fastnode.options.rollupConfig as any, config);

  const outputConfig = config.output as NonNullable<RollupConfig["output"]>;
  if (outputConfig.inlineDynamicImports || outputConfig.format === "iife") {
    delete outputConfig.manualChunks;
  }

  return config;
};
