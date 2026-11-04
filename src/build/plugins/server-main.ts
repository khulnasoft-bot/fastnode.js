import type { Fastnode } from "fastnode/types";
import type { Plugin } from "rollup";

export function serverMain(fastnode: Fastnode): Plugin {
  return {
    name: "fastnode:server-main",
    renderChunk(code, chunk) {
      if (chunk.isEntry) {
        return {
          code: `globalThis.__fastnode_main__ = import.meta.url; ${code}`,
          map: null,
        };
      }
      return undefined;
    },
  };
}
