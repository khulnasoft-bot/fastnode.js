import { defineConfig } from "vite";
import { fastnode } from "fastnode/vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [fastnode(), react()],
  environments: {
    client: {
      build: { rollupOptions: { input: "./src/entry-client.tsx" } },
    },
  },
});
