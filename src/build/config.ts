import type { Fastnode, FastnodeImportMeta } from "fastnode/types";
import { pkgDir } from "#fastnode/meta";
import { pathRegExp, toPathRegExp } from "../utils/regex.ts";
import { BUILD_EXTENSIONS } from "./_extensions.ts";
import { resolveBuildEnv } from "./env.ts";
import { isUnenvId } from "./plugins/unenv.ts";

export type BaseBuildConfig = Awaited<ReturnType<typeof baseBuildConfig>>;

const ROOT_ALIAS = "@";

export async function baseBuildConfig(fastnode: Fastnode) {
  const extensions: string[] = [...BUILD_EXTENSIONS];

  const isNodeless = fastnode.options.node === false;

  const importMetaInjections: FastnodeImportMeta = {
    dev: fastnode.options.dev,
    envName: fastnode.options.envName,
    preset: fastnode.options.preset,
    prerender: fastnode.options.preset === "fastnode-prerender",
    fastnode: true,
    server: true,
    client: false,
    baseURL: fastnode.options.baseURL,
    _asyncContext: fastnode.options.experimental.asyncContext,
    _tasks: fastnode.options.experimental.tasks,
    _websocket: fastnode.options.features.websocket ?? fastnode.options.experimental.websocket,
  };

  const replacements = {
    ...Object.fromEntries(
      Object.entries(importMetaInjections).map(([key, val]) => [
        `import.meta.${key}`,
        JSON.stringify(val),
      ])
    ),
    ...fastnode.options.replace,
  };

  const env = await resolveBuildEnv(fastnode);

  // Aliases to `unenv` polyfills are resolved on demand by the `fastnode:unenv` plugin
  const aliases = resolveAliases(
    Object.fromEntries(Object.entries(env.alias).filter(([, to]) => !isUnenvId(to)))
  );

  const noExternal: RegExp[] = getNoExternals(fastnode);

  const ignoreWarningCodes = new Set([
    "EVAL",
    "CIRCULAR_DEPENDENCY",
    "THIS_IS_UNDEFINED",
    "EMPTY_BUNDLE",
    // Directives such as `"use client"` in dependencies only mean something to
    // React Server Components bundlers, so the server build has nothing to preserve.
    "MODULE_LEVEL_DIRECTIVE",
  ]);

  return {
    extensions,
    isNodeless,
    replacements,
    env,
    aliases,
    noExternal,
    ignoreWarningCodes,
  };
}

function getNoExternals(fastnode: Fastnode): RegExp[] {
  const noExternal: RegExp[] = [
    /\.[mc]?tsx?$/,
    /^(?:[\0#~.]|virtual:)/,
    new RegExp("^" + pathRegExp(pkgDir) + "(?!.*node_modules)"),
    ...[
      fastnode.options.rootDir,
      ...[fastnode.options.buildDir, ...fastnode.options.scanDirs].filter(
        (dir) => dir.includes("node_modules") || !dir.startsWith(fastnode.options.rootDir)
      ),
    ].map((dir) => new RegExp("^" + pathRegExp(dir) + "(?!.*node_modules)")),
  ];

  if (fastnode.options.wasm !== false) {
    noExternal.push(/\.wasm$/);
  }

  if (Array.isArray(fastnode.options.noExternals)) {
    noExternal.push(
      ...fastnode.options.noExternals
        .filter(Boolean)
        .map((item) => toPathRegExp(item as string | RegExp))
    );
  }

  return noExternal.sort((a, b) => a.source.length - b.source.length);
}

export function resolveAliases(_aliases: Record<string, string>) {
  // Sort aliases from specific to general (ie. fs/promises before fs)
  const aliases = Object.fromEntries(
    Object.entries(_aliases).sort(
      ([a], [b]) => b.split("/").length - a.split("/").length || b.length - a.length
    )
  );
  const resolvableAliases = Object.keys(aliases).filter(isResolvableAliasKey);
  // Resolve alias values in relation to each other
  for (const key in aliases) {
    let resolved = aliases[key]!;
    if (!isResolvableAliasValue(resolved)) {
      continue;
    }
    for (const alias of resolvableAliases) {
      if (alias === ROOT_ALIAS && !resolved.startsWith(`${ROOT_ALIAS}/`)) {
        continue;
      } // Don't resolve @foo/bar

      if (resolved.startsWith(alias)) {
        resolved = aliases[alias]! + resolved.slice(alias.length);
      }
    }
    aliases[key] = resolved;
  }
  return aliases;
}

function isResolvableAliasKey(id: string) {
  // Internal aliases: `~`, `~~`, `@`, `@@`, `#*` (but not scoped packages like `@scope/pkg`)
  return id[0] === "~" || id[0] === "#" || /^@+$/.test(id);
}

function isResolvableAliasValue(id: string) {
  return id[0] === "~" || id[0] === "#" || /^@+\//.test(id);
}
