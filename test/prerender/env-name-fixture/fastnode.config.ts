import { defineConfig } from "fastnode";

export default defineConfig({
  preset: "static",
  prerender: { crawlLinks: false, routes: ["/"] },
  runtimeConfig: { target: "default" },
  commands: {
    deploy: (fastnode) => {
      (globalThis as any).__fastnodeDeployEnvName = fastnode.options.envName;
    },
  },
  $env: {
    staging: { runtimeConfig: { target: "staging" } },
  },
});
