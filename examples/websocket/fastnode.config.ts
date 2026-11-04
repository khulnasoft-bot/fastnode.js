import { defineConfig } from "fastnode";

export default defineConfig({
  serverDir: "./",
  renderer: { static: true },
  features: { websocket: true },
});
