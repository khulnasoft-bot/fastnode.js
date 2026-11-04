import { fastnode } from "fastnode/vite";
import { defineConfig } from "vite";

// Tests run in Node.js, without the `miniflare` runner of the preset
export default defineConfig({
  cacheDir: "./node_modules/.vite",
  plugins: [
    fastnode({
      serverDir: "./",
      preset: "cloudflare-module",
      // Only set up with the `miniflare` runner (imports `cloudflare:workers`)
      tracingChannel: true,
      runtimeConfig: { greeting: "hello" },
    }),
  ],
});
