import { getRolldownConfig } from "./config.ts";
import type { Fastnode } from "fastnode/types";
import { importRolldown } from "./_import.ts";
import { watchDev } from "./dev.ts";
import { buildProduction } from "./prod.ts";

export async function rolldownBuild(fastnode: Fastnode) {
  // Installed on demand before the config, so its build plugins use the `rolldown` oxc bindings
  const rolldown = await importRolldown(fastnode.options.rootDir, {
    deps: fastnode.options.deps,
  });
  await fastnode.hooks.callHook("build:before", fastnode);
  const config = await getRolldownConfig(fastnode);
  await fastnode.hooks.callHook("build:config", fastnode, {
    builder: "rolldown",
    rolldown: config,
  });
  return fastnode.options.dev
    ? watchDev(fastnode, config, rolldown)
    : buildProduction(fastnode, config, rolldown);
}
