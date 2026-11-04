import type { Plugin as VitePlugin } from "vite";
import { isBuiltin } from "node:module";

const FACADE_PREFIX = "\0fastnode-require-external:";

/**
 * Service environments (e.g. SSR) keep their dependencies external, and Fastnode bundles them in
 * its own build. A `require()` of one of them from bundled CommonJS would be emitted as a
 * runtime `createRequire()` call that the Fastnode build cannot follow, leaving it unresolved (or
 * loading a second instance) at runtime. It is turned into an ESM import instead, the same way
 * as rolldown's `esmExternalRequirePlugin` but for any dependency Vite resolves as external.
 */
export function fastnodeRequireExternals(): VitePlugin {
  return {
    name: "fastnode:require-externals",
    apply: "build",
    applyToEnvironment: (env) => env.name !== "fastnode" && env.config.consumer === "server",

    resolveId: {
      order: "pre",
      // Bare specifiers only (`kind` cannot be filtered natively)
      filter: { id: /^[\w@][^:]*$/ },
      async handler(id, importer, options) {
        if (importer?.startsWith(FACADE_PREFIX)) {
          return { id, external: true };
        }
        if (options.kind !== "require-call" || isBuiltin(id)) {
          return;
        }
        const resolved = await this.resolve(id, importer, { ...options, skipSelf: true });
        if (resolved?.external) {
          return FACADE_PREFIX + resolved.id;
        }
        return undefined;
      },
    },

    load: {
      filter: { id: /^\0fastnode-require-external:/ },
      handler(id) {
        const source = JSON.stringify(id.slice(FACADE_PREFIX.length));
        return [
          `import * as m from ${source};`,
          `module.exports = Object.prototype.hasOwnProperty.call(m, "module.exports") ? m["module.exports"] : { ...m };`,
        ].join("\n");
      },
    },
  };
}
