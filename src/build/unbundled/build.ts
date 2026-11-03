import type { Fastnode } from "fastnode/types";
import { watchDev } from "./dev.ts";

export async function unbundledBuild(fastnode: Fastnode) {
  assertUnbundledSupport(fastnode);
  await fastnode.hooks.callHook("build:before", fastnode);
  return watchDev(fastnode);
}

/** Throw for what `builder: false` does not support yet (production builds). */
export function assertUnbundledSupport(fastnode: Fastnode) {
  if (!fastnode.options.dev) {
    throw new Error(
      "Production builds are not supported with `builder: false` yet. Set `builder` to `rolldown`, `rollup` or `vite` to build."
    );
  }
}
