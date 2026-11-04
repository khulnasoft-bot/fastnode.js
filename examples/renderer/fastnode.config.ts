import { defineConfig } from "fastnode";

export default defineConfig({
  serverDir: "./",
  renderer: { handler: "./renderer" },
});
