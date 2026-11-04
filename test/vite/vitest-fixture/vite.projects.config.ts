import { fastnode } from "fastnode/vite";
import { defineConfig } from "vitest/config";

// Inline projects resolve from the raw `test` config, before Fastnode's defaults apply
export default defineConfig({
  cacheDir: "./node_modules/.vite",
  plugins: [fastnode({ serverDir: "./", runtimeConfig: { greeting: "hello" } })],
  test: { projects: [{ extends: true, test: { name: "server", environment: "fastnode" } }] },
});
