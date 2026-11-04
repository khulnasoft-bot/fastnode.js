import { fastnode } from "fastnode/vite";
import { defineConfig } from "vite";

export default defineConfig({
  // Separate from the deps cache of the Vite servers other tests run concurrently
  cacheDir: "./node_modules/.vite",
  plugins: [fastnode({ serverDir: "./", runtimeConfig: { greeting: "hello" } })],
});
