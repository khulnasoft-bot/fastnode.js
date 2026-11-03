import { defineConfig } from "fastnode";

export default defineConfig({
  vite: {
    assetsImport: false,
    services: { api: { entry: "./api-entry.ts" } },
  },
});
