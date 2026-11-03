import { defineConfig } from "vite";
import { fastnode } from "fastnode/vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [fastnode()],
  resolve: {
    alias: {
      "@vite-aliased": fileURLToPath(new URL("app/vite-aliased.ts", import.meta.url)),
    },
  },
});
