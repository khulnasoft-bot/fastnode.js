import type { Fastnode } from "fastnode/types";
import type { Plugin } from "rollup";
import { pkgDir } from "#fastnode/meta";
import { depPackageName } from "../../utils/_dep-path.ts";
import { deps } from "../../utils/_deps.ts";
import type { DepId } from "../../utils/_deps.ts";
import { ensureDep, missingDepError, resolveDep } from "../../utils/dep.ts";
import { pathRegExp } from "../../utils/regex.ts";

/** Runtime dependencies of opt-in features, installed in the project on demand. */
const optionalRuntimeDeps = (Object.keys(deps) as DepId[]).filter(
  (id) => (deps[id] as { runtime?: boolean }).runtime
);

/** Matches imports of optional runtime dependencies (and their subpaths). */
export const OPTIONAL_RUNTIME_DEPS_RE: RegExp = new RegExp(
  `^(${optionalRuntimeDeps.join("|")})(\\/|$)`
);

const RUNTIME_IMPORTER_RE = new RegExp(`^(#fastnode/|\0|${pathRegExp(pkgDir)}(?!.*node_modules))`);

/** Whether a module is part of the Fastnode runtime (or a Fastnode virtual module). */
export function isRuntimeImporter(importer: string | undefined): boolean {
  return !!importer && RUNTIME_IMPORTER_RE.test(importer);
}

/**
 * Ensure an optional runtime dependency imported as `id` is installed in the project,
 * installing it (without prompting) if missing.
 */
export async function ensureRuntimeDep(fastnode: Fastnode, id: string): Promise<void> {
  const opts = runtimeDepOptions(fastnode, id);
  if (!(await ensureDep(opts))) {
    throw missingDepError(opts);
  }
}

/** Error for an optional runtime dependency imported as `id` that is not installed. */
export function missingRuntimeDepError(fastnode: Fastnode, id: string): Error {
  return missingDepError(runtimeDepOptions(fastnode, id));
}

/**
 * Resolves optional runtime dependencies (`unstorage`, `db0`) imported by the Fastnode runtime.
 *
 * They are not dependencies of Fastnode: they are resolved from the project and only installed
 * once a build actually imports them (e.g. `fastnode/kv` or `fastnode/database` is used).
 */
export function runtimeDeps(fastnode: Fastnode): Plugin {
  return {
    name: "fastnode:runtime-deps",
    resolveId: {
      order: "pre",
      filter: { id: OPTIONAL_RUNTIME_DEPS_RE },
      async handler(id, importer, options) {
        // Imports from user code and dependencies keep their regular resolution
        if (!isRuntimeImporter(importer)) {
          return;
        }
        await ensureRuntimeDep(fastnode, id);
        const path = resolveDep(id, {
          dir: fastnode.options.rootDir,
          deps: fastnode.options.deps,
        });
        if (!path) {
          const name = depPackageName(id);
          throw new Error(
            `Cannot resolve \`${id}\` from \`${fastnode.options.rootDir}\`. Please make sure \`${name}@${deps[name as DepId].version}\` is installed in your project.`
          );
        }
        return (await this.resolve(path, importer, { ...options, skipSelf: true })) || path;
      },
    },
  };
}

function runtimeDepOptions(fastnode: Fastnode, id: string) {
  const name = depPackageName(id) as DepId;
  return {
    id: name,
    dir: fastnode.options.rootDir,
    deps: fastnode.options.deps,
  };
}
