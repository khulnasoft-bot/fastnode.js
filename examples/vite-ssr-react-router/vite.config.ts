import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { fastnode } from "fastnode/vite";

import reactRouterConfig from "./react-router.config";

export default defineConfig({
  plugins: [
    tailwindcss(),
    reactRouter(),
    fastnode({
      serverDir: "./server",
      output: {
        dir: reactRouterConfig.buildDirectory,
        serverDir: `${reactRouterConfig.buildDirectory}/server`,
        publicDir: `${reactRouterConfig.buildDirectory}/client`,
      },
    }),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  environments: {
    ssr: { build: { rollupOptions: { input: "./server/ssr.ts" } } },
  },
});
