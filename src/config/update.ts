import consola from "consola";
import type { Fastnode, FastnodeDynamicConfig } from "fastnode/types";
import { normalizeRouteRules } from "./resolver/route-rules.ts";
import { normalizeRuntimeConfig } from "./resolver/runtime-config.ts";

export async function updateFastnodeConfig(fastnode: Fastnode, config: FastnodeDynamicConfig) {
  fastnode.options.routeRules = normalizeRouteRules(config.routeRules ? config : fastnode.options);
  fastnode.options.runtimeConfig = normalizeRuntimeConfig(
    config.runtimeConfig ? config : fastnode.options
  );
  await fastnode.hooks.callHook("build:reload");
  consola.success("Fastnode config hot reloaded!");
}
