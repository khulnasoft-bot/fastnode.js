import { getRollupConfig } from "./config.ts";
import type { Fastnode } from "fastnode/types";
import { watchDev } from "./dev.ts";
import { buildProduction } from "./prod.ts";

export async function rollupBuild(fastnode: Fastnode) {
  await fastnode.hooks.callHook("build:before", fastnode);
  const config = await getRollupConfig(fastnode);
  await fastnode.hooks.callHook("build:config", fastnode, { builder: "rollup", rollup: config });
  return fastnode.options.dev ? watchDev(fastnode, config) : buildProduction(fastnode, config);
}
