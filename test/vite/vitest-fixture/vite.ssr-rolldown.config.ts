import { fastnode } from "fastnode/vite";
import { defineConfig } from "vite";

// SSR entry configured with `rolldownOptions` (instead of auto-detected)
export default defineConfig({
  cacheDir: "./node_modules/.vite",
  plugins: [fastnode({ serverDir: "./", runtimeConfig: { greeting: "hello" } })],
  environments: {
    ssr: { build: { rolldownOptions: { input: "./entry-server.ts" } } },
  },
});
