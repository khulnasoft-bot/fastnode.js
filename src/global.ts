import type { Fastnode } from "fastnode/types";

/**
 * Build-time Fastnode instances registered via `registerFastnodeInstance()`.
 *
 * This is a compatibility singleton used by serverless presets: when a preset's
 * entry handler is invoked as `globalThis.fetch(req)`, it routes through
 * `__fastnode_builder__.fetch` which delegates to the most recently registered
 * `Fastnode` instance (`fastnodeInstances[0]`).
 *
 * Only one `Fastnode` instance is expected per isolate. Concurrent instances
 * (e.g. multiple test apps in the same process) share this registry, and
 * `fetch()` always targets the latest-registered instance. Callers needing
 * isolation should use an explicit `fastnode.fetch(req)` handle instead.
 */
const fastnodeInstances: Fastnode[] = ((globalThis as any).__fastnode_instances__ ||= []);

const globalKey = "__fastnode_builder__";

declare global {
  /**
   * Build-time `Fastnode` instance fetch handler, set by `globalInit()` on first
   * `registerFastnodeInstance()` call and removed when the last instance closes.
   */
  var __fastnode_builder__: {
    fetch: (req: Request) => Promise<Response>;
  };
}

export function registerFastnodeInstance(fastnode: Fastnode) {
  if (fastnodeInstances.includes(fastnode)) {
    return;
  }
  globalInit();
  fastnodeInstances.unshift(fastnode);
  fastnode.hooks.hookOnce("close", () => {
    fastnodeInstances.splice(fastnodeInstances.indexOf(fastnode), 1);
    if (fastnodeInstances.length === 0) {
      delete (globalThis as any)[globalKey];
    }
  });
}

function globalInit() {
  if (globalThis[globalKey]) {
    return;
  }
  globalThis[globalKey] = {
    async fetch(req) {
      for (let r = 0; r < 10 && fastnodeInstances.length === 0; r++) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      const fastnode = fastnodeInstances[0];
      if (!fastnode) {
        throw new Error("No Fastnode instance is running.");
      }
      return fastnode.fetch(req);
    },
  };
}
