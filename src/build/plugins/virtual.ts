import type { Plugin, ResolvedId } from "rollup";
import { pathRegExp } from "../../utils/regex.ts";
import { runtimeDependencies, runtimeDir } from "#fastnode/meta";

export type VirtualModule = {
  id: string;
  moduleSideEffects?: boolean;
  template: string | (() => string | Promise<string>);
};

export function virtual(input: VirtualModule[]): Plugin {
  const modules = new Map<
    string,
    { module: VirtualModule; render: () => string | Promise<string> }
  >();
  for (const mod of input) {
    const render = () => (typeof mod.template === "function" ? mod.template() : mod.template);
    modules.set(mod.id, { module: mod, render });
  }

  const include: RegExp[] = [/^#fastnode\/virtual/];

  const extraIds = [...modules.keys()].filter((key) => !key.startsWith("#fastnode/virtual"));
  if (extraIds.length > 0) {
    include.push(new RegExp(`^(${extraIds.map((id) => pathRegExp(id)).join("|")})$`));
  }

  return {
    name: "fastnode:virtual",
    api: {
      modules,
    },
    resolveId: {
      order: "pre",
      filter: { id: include },
      handler: (id) => {
        const mod = modules.get(id);
        if (mod) {
          return {
            id,
            moduleSideEffects: mod.module.moduleSideEffects ?? false,
          };
        }
        return undefined;
      },
    },
    load: {
      order: "pre",
      filter: { id: include },
      handler: async (id) => {
        const mod = modules.get(id);
        if (!mod) {
          return null;
        }
        return {
          code: await mod.render(),
          map: null,
        };
      },
    },
  };
}

export function virtualDeps(): Plugin {
  const cache = new Map<string, ResolvedId | null | Promise<ResolvedId | null>>();

  return {
    name: "fastnode:virtual-deps",
    resolveId: {
      order: "pre",
      filter: {
        id: new RegExp(
          `^(#fastnode|${runtimeDependencies.map((dep) => pathRegExp(dep)).join("|")})`
        ),
      },
      handler(id, importer) {
        // https://github.com/rolldown/rolldown/issues/7529
        if (!importer || !importer.startsWith("#fastnode/virtual")) {
          return;
        }
        let resolved = cache.get(id);
        if (!resolved) {
          resolved = this.resolve(id, runtimeDir)
            .then((_resolved) => {
              cache.set(id, _resolved);
              return _resolved;
            })
            .catch((error) => {
              cache.delete(id);
              throw error;
            });
        }
        return resolved;
      },
    },
  };
}
