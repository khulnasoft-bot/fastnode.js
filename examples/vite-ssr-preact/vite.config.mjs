import { defineConfig } from "vite";
import { fastnode } from "fastnode/vite";
import preact from "@preact/preset-vite";

export default defineConfig({
  plugins: [fastnode(), preact()],
  environments: {
    client: {
      build: {
        rollupOptions: {
          input: "./src/entry-client.tsx",
        },
      },
    },
  },
});
