import { defineConfig } from "vite";
import { fastnode } from "fastnode/vite";

export default defineConfig({
  plugins: [fastnode({ prerender: { routes: ["/"] } })],
  environments: {
    client: {
      build: { rollupOptions: { input: "src/entry-client.ts" } },
    },
  },
});
