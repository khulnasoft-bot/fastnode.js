import type { Fastnode } from "fastnode/types";
import { isTest } from "std-env";
import { fastnode as fastnodePlugin } from "fastnode/vite";
import { importVite, viteImportOptions } from "./_import.ts";

export async function viteBuild(fastnode: Fastnode) {
  if (fastnode.options.dev) {
    throw new Error("Fastnode dev CLI does not supports vite. Please use `vite dev` instead.");
  }

  const { createBuilder } = await importVite({
    ...viteImportOptions(fastnode),
    id: (fastnode.options as any).__vitePkg__,
  });

  const pluginInstance = fastnodePlugin({ _fastnode: fastnode });

  (globalThis as any).__fastnode_build__ = true;

  const builder = await createBuilder({
    root: fastnode.options.rootDir,
    plugins: [pluginInstance],
    logLevel: isTest ? "warn" : undefined,
  });

  delete (globalThis as any).__fastnode_build__;

  await builder.buildApp();
}
