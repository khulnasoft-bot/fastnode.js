import { defineConfig } from "fastnode";

export default defineConfig({
  preset: "standard",
  serverDir: "./",
  vite: {
    services: { api: { entry: "./service.ts" } },
  },
});
