import type { ViteBuilder } from "vite";
import type { FastnodePluginContext } from "./types.ts";

import { basename, dirname, resolve } from "pathe";
import { formatCompatibilityDate } from "compatx";
import { colors as C } from "consola/utils";
import { copyPublicAssets, prerender } from "../../../builder.ts";
import { compressPublicAssets } from "../../../utils/compress.ts";
import { existsSync } from "node:fs";
import { writeBuildInfo } from "../../info.ts";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { isTest, isCI } from "std-env";
import { readBuiltServiceEntry } from "./services.ts";
import type { RolldownOutput } from "rolldown";

const BuilderNames = {
  fastnode: C.magenta("Fastnode"),
  client: C.green("Client"),
  ssr: C.blue("SSR"),
} as Record<string, string>;

export async function buildEnvironments(ctx: FastnodePluginContext, builder: ViteBuilder) {
  const fastnode = ctx.fastnode!;

  // ----------------------------------------------
  // Stage 1: Build all environments before Fastnode
  // ----------------------------------------------

  for (const [envName, env] of Object.entries(builder.environments)) {
    // prettier-ignore
    const fmtName = BuilderNames[envName] || (envName.length <= 3 ? envName.toUpperCase() : envName[0]!.toUpperCase() + envName.slice(1));
    if (env.isBuilt && ctx.services[envName] && !ctx._entryPoints[envName]) {
      const outDir = resolve(env.config.root, env.config.build.outDir);
      const entry = await readBuiltServiceEntry(outDir);
      if (entry) {
        ctx._entryPoints[envName] = entry;
      }
    }
    if (envName === "fastnode" || !env.config.build.rollupOptions.input || env.isBuilt) {
      if (!["fastnode", "ssr", "client"].includes(envName)) {
        fastnode.logger.info(
          env.isBuilt
            ? `Skipping ${fmtName} (already built)`
            : `Skipping ${fmtName} (no input defined)`
        );
      }
      continue;
    }
    if (!isTest && !isCI) console.log();
    fastnode.logger.start(`Building [${fmtName}]`);
    await builder.build(env);
  }

  // Use transformed client input for renderer template generation
  const fastnodeOptions = ctx.fastnode!.options;
  const clientInput = builder.environments.client?.config?.build?.rollupOptions?.input;
  if (fastnodeOptions.renderer?.template && fastnodeOptions.renderer?.template === clientInput) {
    const outputPath = resolve(fastnodeOptions.output.publicDir, basename(clientInput as string));
    if (existsSync(outputPath)) {
      const html = await readFile(outputPath, "utf8").then((r) =>
        r.replace("<!--ssr-outlet-->", `{{{ fetchViteEnv("ssr", $REQUEST) || "" }}}`)
      );
      await rm(outputPath);
      const tmp = resolve(fastnodeOptions.buildDir, "vite/index.html");
      await mkdir(dirname(tmp), { recursive: true });
      await writeFile(tmp, html, "utf8");
      fastnodeOptions.renderer.template = tmp;
    }
  }

  // Extended builder API by assets plugin
  // https://github.com/hi-ogawa/vite-plugins/pull/1288
  await builder.writeAssetsManifest?.();

  // ----------------------------------------------
  // Stage 2: Build Fastnode
  // ----------------------------------------------

  if (!isTest && !isCI) console.log();
  const buildInfo = [
    ["preset", fastnode.options.preset],
    ["compatibility", formatCompatibilityDate(fastnode.options.compatibilityDate)],
  ].filter((e) => e[1]);
  fastnode.logger.start(
    `Building [${BuilderNames.fastnode}] ${C.dim(`(${buildInfo.map(([k, v]) => `${k}: \`${v}\``).join(", ")})`)}`
  );

  // Copy public assets to the final output directory
  await copyPublicAssets(fastnode);

  // Add route rule for asset dirs
  const assetDirs = new Set(
    Object.values(builder.environments)
      .filter((env) => env.config.consumer === "client")
      .map((env) => env.config.build.assetsDir)
      .filter(Boolean) as string[]
  );
  for (const assetsDir of assetDirs) {
    if (!existsSync(resolve(fastnode.options.output.publicDir, assetsDir))) {
      continue;
    }
    const rule = (ctx.fastnode!.options.routeRules[`/${assetsDir}/**`] ??= {});
    if (rule.headers !== false && !rule.headers?.["cache-control"]) {
      rule.headers = {
        ...rule.headers,
        "cache-control": `public, max-age=31536000, immutable`,
      };
    }
  }
  ctx.fastnode!.routing.sync();

  // Prerender routes if configured
  await prerender(fastnode);

  // Call vite:compile:before hook
  await fastnode.hooks.callHook("vite:compile:before", fastnode);

  if (fastnode.options.compressPublicAssets) {
    await compressPublicAssets(fastnode);
  }

  // Build the Fastnode server bundle
  let output: RolldownOutput | undefined;
  if (fastnode.options.static) {
    // Mark as built to opt out of Vite's fallback that builds every environment
    // when a `buildApp` hook left all of them unbuilt.
    builder.environments.fastnode!.isBuilt = true;
  } else {
    output = (await builder.build(builder.environments.fastnode!)) as RolldownOutput;
  }

  // Close the Fastnode instance
  await fastnode.close();

  // Call compiled hook
  await fastnode.hooks.callHook("compiled", fastnode);

  if (fastnode.options.compressPublicAssets) {
    await compressPublicAssets(fastnode);
  }

  // Write build info
  await writeBuildInfo(fastnode, output);

  // Show deploy and preview commands
  if (!isTest && !isCI) console.log();
  const previewCommand = fastnode.options.framework.previewCommand || "npx vite preview";
  fastnode.logger.success(`You can preview this build using \`${previewCommand}\``);
  if (fastnode.options.commands.deploy) {
    const deployCommand =
      fastnode.options.framework.deployCommand || "npx fastnode deploy --prebuilt";
    fastnode.logger.success(`You can deploy this build using \`${deployCommand}\``);
  }
}
