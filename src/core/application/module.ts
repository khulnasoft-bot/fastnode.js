import type { Fastnode, FastnodeModule, FastnodeModuleInput } from "fastnode/types";
import { resolveModuleURL } from "exsolve";

// Modules already installed for a Fastnode instance, keyed by resolved URL (string inputs)
// or by `setup` identity (inline modules) to keep `installModules` idempotent.
// (config loading clones module objects, but keeps the `setup` reference)
const installedModules = new WeakMap<Fastnode, Set<unknown>>();

export async function installModules(fastnode: Fastnode, moduleInputs?: FastnodeModuleInput[]) {
  const _modules = [...(moduleInputs ?? fastnode.options.modules ?? [])];
  const modules = await Promise.all(
    _modules.map((mod) => _resolveFastnodeModule(mod, fastnode.options))
  );
  let _installed = installedModules.get(fastnode);
  if (!_installed) {
    _installed = new Set();
    installedModules.set(fastnode, _installed);
  }
  for (const mod of modules) {
    const key = mod._url ?? mod.setup;
    if (_installed.has(key)) {
      continue;
    }
    _installed.add(key);
    await mod.setup(fastnode);
  }
}

async function _resolveFastnodeModule(
  mod: FastnodeModuleInput,
  fastnodeOptions: Fastnode["options"]
): Promise<FastnodeModule & { _url?: string }> {
  let _url: string | undefined;

  if (typeof mod === "string") {
    _url = resolveModuleURL(mod, {
      from: [fastnodeOptions.rootDir],
      extensions: [".mjs", ".cjs", ".js", ".mts", ".cts", ".ts"],
    });
    mod = (await import(_url).then((m: any) => m.default || m)) as FastnodeModule;
  }

  if (typeof mod === "function") {
    mod = { setup: mod };
  }

  if ("fastnode" in mod) {
    mod = mod.fastnode;
  }

  if (!mod.setup) {
    throw new Error("Invalid Fastnode module: missing setup() function.");
  }

  return {
    _url,
    ...mod,
  };
}
