import type { Fastnode } from "fastnode/types";

const fastnodeInstances: Fastnode[] = ((globalThis as any).__fastnode_instances__ ||= []);

const globalKey = "__fastnode_builder__";

declare global {
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
