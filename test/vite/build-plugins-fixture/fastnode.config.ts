import { defineConfig } from "fastnode";
import type { FastnodeBuildPlugin } from "fastnode/types";

export default defineConfig({
  preset: "standard",
  virtual: {
    "#order-pre": () => `export default "fastnode"`,
    "#order-normal": () => `export default "fastnode"`,
    "#order-post": () => `export default "fastnode"`,
  },
  modules: [
    (fastnode) => {
      fastnode.options.buildPlugins.push(virtualModule("virtual:module", "module"));
    },
  ],
  buildPlugins: [
    virtualModule("#order-pre", "pre", "pre"),
    virtualModule("#order-normal", "normal"),
    virtualModule("#order-post", "post", "post"),
    Promise.resolve([virtualModule("virtual:promise", "promise"), false]),
  ],
});

function virtualModule(id: string, value: string, enforce?: "pre" | "post"): FastnodeBuildPlugin {
  const resolvedId = `\0build-plugins:${id}`;
  return {
    name: `fixture:${value}`,
    enforce,
    resolveId: {
      // Same hook order as Fastnode's virtual modules: only the plugin position differs
      order: "pre",
      filter: { id: new RegExp(`^${id}$`) },
      handler: () => resolvedId,
    },
    load: {
      filter: { id: new RegExp(`^\0build-plugins:${id}$`) },
      handler: () => `export default ${JSON.stringify(value)}`,
    },
  };
}
