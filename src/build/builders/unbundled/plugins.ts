import type { EnvRunnerPlugin, PluginContext } from "env-runner";
import type { Fastnode, FastnodeBuildPlugin } from "fastnode/types";

import { existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import replace from "@rollup/plugin-replace";
import MagicString from "magic-string";
import { pkgDir } from "#fastnode/meta";
import { dirname, isAbsolute, join, normalize, resolve } from "pathe";
import { unwasm } from "unwasm/plugin";
import { baseBuildConfig } from "../../config.ts";
import { FASTNODE_VIRTUAL_PREFIX, fastnodeVirtualPath } from "./entry.ts";
import { importAttributes } from "../../plugins/import-attributes.ts";
import { resolveDep } from "../../../utils/dep.ts";
import { importOXC } from "../../../utils/oxc.ts";
import { chain } from "../../../utils/sync.ts";
import { raw, RESOLVED_PREFIX as RAW_PREFIX, RESOLVED_RE as RAW_RE } from "../../plugins/raw.ts";
import { routeMeta } from "../../plugins/route-meta.ts";
import { tsconfigPaths } from "../../plugins/tsconfig-paths.ts";
import { resolveBuildPlugins } from "../../plugins.ts";
import {
  ensureRuntimeDep,
  isRuntimeImporter,
  missingRuntimeDepError,
  OPTIONAL_RUNTIME_DEPS_RE,
} from "../../plugins/runtime-deps.ts";

const SCRIPT_TYPES = ["js", "jsx", "ts", "tsx"] as const;

const SUPPORTED_HOOKS = new Set(["resolveId", "load", "transform"]);

export interface UnbundledPluginsOptions {
  /**
   * Plugins for env-runner's self runner, whose hooks must be synchronous: optional runtime
   * dependencies that are not installed fail to resolve instead of being installed.
   */
  sync?: boolean;
}

/**
 * env-runner plugins (run on the host) to load the server sources like a bundled build:
 * extensionless imports, aliases, TypeScript and JSX, `import.meta.*` replacements, raw and
 * WASM imports.
 */
export async function unbundledPlugins(
  fastnode: Fastnode,
  opts: UnbundledPluginsOptions = {}
): Promise<EnvRunnerPlugin[]> {
  const base = await baseBuildConfig(fastnode);

  // Sources Fastnode would bundle: its own runtime and the app (`node_modules` needs a named include)
  const sourceDirs = [pkgDir, fastnode.options.rootDir, ...fastnode.options.scanDirs].map(
    (dir) => `${escapeGlob(normalize(dir).replace(/\/$/, ""))}/**`
  );

  const plugins: EnvRunnerPlugin[] = [
    virtualPlugin(),
    runtimeDepsPlugin(fastnode, opts.sync),
    resolvePlugin(fastnode, base.extensions),
    windowsPathPlugin(base.extensions),
    await transformPlugin(fastnode, sourceDirs),
    replacePlugin(base.replacements, sourceDirs),
    withoutSourceMap(fromRollup(await importAttributes(fastnode))),
    rawVirtualPlugin(fastnode),
    fromRollup(raw()),
  ];

  if (Object.keys(base.aliases).length > 0) {
    plugins.push(await aliasPlugin(fastnode, base.aliases, sourceDirs));
  }

  const tsconfigPathsPlugin = tsconfigPaths(fastnode, base.aliases);
  if (tsconfigPathsPlugin) {
    plugins.push(fromRollup(tsconfigPathsPlugin));
  }

  if (fastnode.options.experimental.openAPI) {
    plugins.push(fromRollup(await routeMeta(fastnode)));
  }

  if (fastnode.options.wasm !== false) {
    plugins.push(fromRollup(unwasm(fastnode.options.wasm || {})));
  }

  // User build plugins (ordered by `enforce` in env-runner)
  for (const plugin of await resolveBuildPlugins(fastnode)) {
    warnUnsupportedHooks(fastnode, plugin);
    plugins.push(fromRollup(plugin));
  }

  return plugins;
}

/**
 * Resolve `#fastnode/virtual/*` to their path keys.
 *
 * Runtimes resolve them natively to the stub files the keys override, except on miniflare,
 * which only serves the keys for this redirect.
 */
function virtualPlugin(): EnvRunnerPlugin {
  return {
    name: "fastnode:virtual",
    resolveId: {
      filter: { id: new RegExp(`^${FASTNODE_VIRTUAL_PREFIX}`) },
      handler: (source) => fastnodeVirtualPath(source),
    },
  };
}

/**
 * Resolve imports the runtime fails to resolve (`fallback`), like bundlers do:
 * - relative and absolute paths without extension or to a directory index.
 * - project dependencies imported by Fastnode virtual modules (keyed under the Fastnode package).
 */
function resolvePlugin(fastnode: Fastnode, extensions: string[]): EnvRunnerPlugin {
  const virtualDir = fastnodeVirtualPath("");
  return {
    name: "fastnode:resolve",
    resolveId: {
      fallback: true,
      filter: { id: /^(?!#fastnode\/)/ },
      handler(this: PluginContext, source, importer) {
        if (/^(?:\.{1,2}\/|\/|[a-zA-Z]:[\\/]|file:)/.test(source)) {
          const [specifier, query] = splitQuery(source);
          const path = specifier.startsWith("file:") ? fileURLToPath(specifier) : specifier;
          const base = isAbsolute(path)
            ? path
            : resolve(importer ? dirname(splitQuery(importer)[0]) : fastnode.options.rootDir, path);
          return resolveFile(base, query, extensions);
        }
        if (importer && normalize(importer).startsWith(virtualDir)) {
          return this.resolve(source, join(fastnode.options.rootDir, "_"));
        }
        return undefined;
      },
    },
  };
}

/**
 * Optional runtime dependencies (`unstorage`, `db0`) imported by the Fastnode runtime: installed
 * on demand (not in `sync` mode) and resolved from the project when the runtime fails to resolve them.
 */
function runtimeDepsPlugin(fastnode: Fastnode, sync?: boolean): EnvRunnerPlugin {
  return {
    name: "fastnode:runtime-deps",
    resolveId: {
      fallback: true,
      filter: { id: OPTIONAL_RUNTIME_DEPS_RE },
      handler(this: PluginContext, source, importer) {
        if (!isRuntimeImporter(importer && normalize(importer))) {
          return;
        }
        const resolve = () => this.resolve(source, join(fastnode.options.rootDir, "_"));
        if (resolveDep(source, { dir: fastnode.options.rootDir, deps: fastnode.options.deps })) {
          return resolve();
        }
        if (sync) {
          throw missingRuntimeDepError(fastnode, source);
        }
        return ensureRuntimeDep(fastnode, source).then(resolve);
      },
    },
  };
}

/**
 * Windows absolute paths (Fastnode virtual modules import sources by path): Node.js rejects them
 * as a `d:` URL scheme instead of failing to resolve, so they skip `fallback` resolvers.
 */
function windowsPathPlugin(extensions: string[]): EnvRunnerPlugin {
  return {
    name: "fastnode:windows-path",
    resolveId: {
      filter: { id: /^[a-zA-Z]:[\\/]/ },
      handler(source) {
        const [path, query] = splitQuery(source);
        return resolveFile(normalize(path), query, extensions);
      },
    },
  };
}

/** TypeScript and JSX, with the same options as the bundled build. */
async function transformPlugin(fastnode: Fastnode, sourceDirs: string[]): Promise<EnvRunnerPlugin> {
  const { transformSync } = await importOXC({
    dir: fastnode.options.rootDir,
    paths: fastnode.options.deps?.paths,
  });
  const tsc = fastnode.options.typescript.tsConfig?.compilerOptions;
  return {
    name: "fastnode:transform",
    transform: {
      filter: { id: sourceDirs, moduleType: ["ts", "tsx", "jsx"] },
      handler(this: PluginContext, code, id, { moduleType }) {
        const result = transformSync(id.split("?")[0]!, code, {
          lang: moduleType as "ts" | "tsx" | "jsx",
          sourcemap: true,
          jsx: {
            runtime: tsc?.jsx === "react" ? "classic" : "automatic",
            pragma: tsc?.jsxFactory,
            pragmaFrag: tsc?.jsxFragmentFactory,
            importSource: tsc?.jsxImportSource,
            development: fastnode.options.dev,
          },
        });
        if (result.errors.length > 0) {
          this.error(result.errors.map((error) => error.message).join("\n"));
        }
        return { code: result.code, map: result.map as any, moduleType: "js" };
      },
    },
  };
}

/**
 * Raw imports of virtual modules (`text:#fastnode/virtual/...`) inline their rendered source.
 *
 * Runs before the raw plugin, which would read the stub file behind the path key instead
 * (bundlers keep virtual ids, for which it uses `this.load()`, unsupported by env-runner).
 */
function rawVirtualPlugin(fastnode: Fastnode): EnvRunnerPlugin {
  const prefixRe = /^(raw|bytes|text):/;
  return {
    name: "fastnode:raw-virtual",
    resolveId: {
      order: "pre",
      filter: { id: [/^raw:/, /^bytes:/, /^text:/] },
      handler(source) {
        const [, type] = prefixRe.exec(source) || [];
        const id = source.slice(`${type}:`.length);
        if (type && fastnode.vfs.has(id)) {
          return `${RAW_PREFIX}${type}:${id}.js`;
        }
        return undefined;
      },
    },
    load: {
      order: "pre",
      filter: { id: RAW_RE },
      handler(id) {
        const [, type] = RAW_RE.exec(id) || [];
        const vfsId = id.replace(RAW_RE, "").slice(0, -".js".length);
        const mod = fastnode.vfs.get(vfsId);
        if (!mod) {
          return;
        }
        return chain(mod.render(), (code) =>
          type === "bytes" ? Buffer.from(code, "utf8").toString("binary") : code
        );
      },
    },
  };
}

/** `import.meta.*` and `replace` values (line-preserving, so without a source map). */
function replacePlugin(
  values: Awaited<ReturnType<typeof baseBuildConfig>>["replacements"],
  sourceDirs: string[]
): EnvRunnerPlugin {
  const plugin = (replace as unknown as typeof replace.default)({
    preventAssignment: true,
    sourceMap: false,
    values,
  });
  const keys = Object.keys(values).map((key) => key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return {
    name: "fastnode:replace",
    transform: {
      order: "post",
      filter: {
        id: { include: sourceDirs, exclude: RAW_RE },
        moduleType: [...SCRIPT_TYPES],
        code: new RegExp(keys.join("|")),
      },
      handler: plugin.transform as any,
    },
  };
}

/** `alias` option (and unenv aliases), resolved like bundlers do (relative targets from `rootDir`). */
async function aliasPlugin(
  fastnode: Fastnode,
  _aliases: Record<string, string>,
  sourceDirs: string[]
): Promise<EnvRunnerPlugin> {
  const { rootDir } = fastnode.options;
  const aliases = Object.fromEntries(
    Object.entries(_aliases).map(([key, target]) => [
      key,
      /^\.{1,2}\//.test(target) ? resolve(rootDir, target) : target,
    ])
  );
  const keys = Object.keys(aliases).map((key) => key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const resolveAlias = (source: string) => {
    for (const [key, target] of Object.entries(aliases)) {
      if (source === key || source.startsWith(key.endsWith("/") ? key : `${key}/`)) {
        return target + source.slice(key.length);
      }
    }
    return undefined;
  };
  const plugin: EnvRunnerPlugin = {
    name: "fastnode:alias",
    resolveId: {
      filter: { id: new RegExp(`^(?:${keys.join("|")})`) },
      handler(this: PluginContext, source, importer) {
        const aliased = resolveAlias(source);
        if (aliased) {
          return chain(
            this.resolve(aliased, importer),
            (resolved) => resolved ?? { id: aliased, external: true }
          );
        }
        return undefined;
      },
    },
  };
  const runner = fastnode.options.devServer?.runner || process.env.FASTNODE_DEV_RUNNER;
  if (!process.versions.bun && runner !== "bun-process") {
    return plugin;
  }
  // Bun runtime plugins do not resolve the bare specifiers of static imports: rewrite them instead
  const { parseSync } = await importOXC({ dir: rootDir, paths: fastnode.options.deps?.paths });
  plugin.transform = {
    filter: { id: sourceDirs, code: new RegExp(`["'\`](?:${keys.join("|")})`) },
    handler(code, id) {
      const { module, errors } = parseSync(id.split("?")[0]!, code);
      if (errors.length > 0) {
        return;
      }
      const requests = new Map(
        [
          ...module.staticImports.map((i) => i.moduleRequest),
          ...module.staticExports.flatMap((e) => e.entries.map((entry) => entry.moduleRequest)),
          ...module.dynamicImports.map((i) => i.moduleRequest),
        ].flatMap((request) => (request ? [[request.start, request]] : []))
      );
      const s = new MagicString(code);
      for (const request of requests.values()) {
        const literal = code.slice(request.start, request.end);
        const aliased =
          /^(?:"[^"]*"|'[^']*'|`[^`$]*`)$/.test(literal) && resolveAlias(literal.slice(1, -1));
        if (aliased) {
          s.overwrite(request.start, request.end, JSON.stringify(aliased));
        }
      }
      return s.hasChanged() ? { code: s.toString() } : undefined;
    },
  };
  return plugin;
}

/**
 * Drop the source map of a line-preserving transform: env-runner does not compose maps, so a
 * second one (from `fastnode:transform`) would drop both.
 */
function withoutSourceMap(plugin: EnvRunnerPlugin): EnvRunnerPlugin {
  const transform = plugin.transform as Exclude<
    NonNullable<EnvRunnerPlugin["transform"]>,
    Function
  >;
  return {
    ...plugin,
    transform: {
      ...transform,
      handler(...args) {
        return chain(transform.handler.apply(this, args), (result) =>
          result && typeof result === "object" ? { ...result, map: undefined } : result
        );
      },
    },
  };
}

/** Rollup plugins only using the hooks and context env-runner supports. */
function fromRollup(plugin: unknown): EnvRunnerPlugin {
  return plugin as EnvRunnerPlugin;
}

/** The path itself, with an extension or as a directory index, like bundlers resolve it. */
function resolveFile(base: string, query: string, extensions: string[]): string | undefined {
  for (const candidate of [
    base,
    ...extensions.map((ext) => base + ext),
    ...extensions.map((ext) => join(base, `index${ext}`)),
  ]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return candidate + query;
    }
  }
  return undefined;
}

function splitQuery(id: string): [path: string, query: string] {
  const index = id.indexOf("?");
  return index === -1 ? [id, ""] : [id.slice(0, index), id.slice(index)];
}

function escapeGlob(path: string) {
  return path.replace(/[*?[\]{}!\\]/g, "\\$&");
}

/** Warn about `buildPlugins` hooks env-runner ignores. */
function warnUnsupportedHooks(fastnode: Fastnode, plugin: FastnodeBuildPlugin) {
  const hooks = Object.keys(plugin).filter((key) => {
    const value = plugin[key];
    // `apply` is a Vite option, not a hook
    return (
      key !== "apply" &&
      !SUPPORTED_HOOKS.has(key) &&
      (typeof value === "function" || typeof value?.handler === "function")
    );
  });
  if (hooks.length > 0) {
    fastnode.logger.warn(
      `Build plugin \`${plugin.name}\` uses hooks not supported with \`builder: false\`, they are ignored: ${hooks.map((hook) => `\`${hook}\``).join(", ")}.`
    );
  }
}
