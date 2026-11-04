import type { FastnodePluginContext } from "./types.ts";
import type { Plugin as VitePlugin } from "vite";
import { readFile } from "node:fs/promises";
import { join, resolve } from "pathe";

// Written next to each service output so a later build that skips it (`isBuilt`) finds its entry.
export const SERVICE_MANIFEST_FILE = "fastnode-service.json";

// Without a manifest (e.g. output of an older Fastnode), the output dir itself is imported (`index.{mjs,js}`).
export async function readBuiltServiceEntry(outDir: string): Promise<string | undefined> {
  try {
    const { entry } = JSON.parse(await readFile(join(outDir, SERVICE_MANIFEST_FILE), "utf8"));
    return typeof entry === "string" ? entry : undefined;
  } catch {
    return undefined;
  }
}

export function viteServicesTemplate(ctx: FastnodePluginContext): string {
  const serviceNames = Object.keys(ctx.services);

  // Dev worker registers the services. Vitest runs without it: entries are imported from the
  // fastnode environment instead.
  if (ctx.fastnode!.options.dev && !ctx._isVitest) {
    return /* js */ `
export const viteServices = {
${serviceNames
  .map(
    (name) =>
      `  get [${JSON.stringify(name)}]() { return globalThis.__fastnode_vite_envs__[${JSON.stringify(name)}] }`
  )
  .join(",\n")}
};
  `;
  }

  const serviceEntries = serviceNames.map((name) => {
    const entry = ctx._isVitest
      ? _resolveServiceEntry(ctx, ctx.services[name]!.entry)
      : resolve(ctx.fastnode!.options.buildDir, "vite/services", name, ctx._entryPoints[name]!);
    return [name, entry];
  });

  return /* js */ `
function lazyService(name, loader) {
  let promise, mod
  return {
    fetch(req) {
      if (mod) { return mod.fetch(req) }
      if (!promise) {
        promise = loader().then(_mod => {
          const m = typeof _mod.default?.fetch === "function" ? _mod.default : _mod
          if (typeof m.fetch !== "function") {
            throw new TypeError(\`[fastnode] Vite service "\${name}" entry does not export a \\\`fetch\\\` handler.\`)
          }
          return (mod = m)
        })
      }
      return promise.then(mod => mod.fetch(req))
    }
  }
}

export const viteServices = {
${serviceEntries
  .map(
    ([name, entry]) =>
      `[${JSON.stringify(name)}]: lazyService(${JSON.stringify(name)}, () => import(${JSON.stringify(entry)}))`
  )
  .join(",\n")}
};
  `;
}

// Service environments (e.g. SSR) must not bundle their own copy of `fastnode/*`
// runtime modules. In dev, imports are proxied to the Fastnode environment via
// __VITE_ENVIRONMENT_RUNNER_IMPORT__. In prod, they are externalized (see createServiceEnvironment).
const FASTNODE_PROXY_PREFIX = "\0fastnode-env-proxy:";
// Vitest runs no dev worker to proxy to: test files import `fastnode/*` from the fastnode environment.
export function fastnodeDevServiceProxy(ctx: FastnodePluginContext): VitePlugin {
  return {
    name: "fastnode:dev-service-proxy",
    enforce: "pre",
    applyToEnvironment: (env) =>
      !ctx._isVitest && env.name !== "fastnode" && env.config.consumer === "server",
    apply: (_config, configEnv) => configEnv.command === "serve",

    resolveId: {
      filter: { id: /^fastnode(\/|$)/ },
      handler(id) {
        if (id === "fastnode" || id.startsWith("fastnode/")) {
          return { id: FASTNODE_PROXY_PREFIX + id, moduleSideEffects: false };
        }
        return undefined;
      },
    },

    load: {
      filter: { id: /^\0fastnode-env-proxy:/ },
      handler(id) {
        if (!id.startsWith(FASTNODE_PROXY_PREFIX)) {
          return;
        }
        const originalId = id.slice(FASTNODE_PROXY_PREFIX.length);
        // __vite_ssr_exportAll__ is provided by the module runner execution context.
        // It re-exports all enumerable own properties (except "default") from the source module.
        return {
          code: [
            `const _mod = await globalThis.__VITE_ENVIRONMENT_RUNNER_IMPORT__("fastnode", ${JSON.stringify(originalId)});`,
            `__vite_ssr_exportAll__(_mod);`,
            `export default _mod.default;`,
          ].join("\n"),
          map: null,
        };
      },
    },
  };
}

function _resolveServiceEntry(ctx: FastnodePluginContext, entry: string): string {
  return entry.startsWith(".") ? resolve(ctx.fastnode!.options.rootDir, entry) : entry;
}
