import solid from "vite-plugin-solid";
import { defineConfig } from "vite";
import { fastnode } from "fastnode/vite";

export default defineConfig({
  plugins: [solid({ ssr: true }), fastnode()],
  esbuild: { jsx: "preserve", jsxImportSource: "solid-js" },
  environments: {
    ssr: {
      build: { rollupOptions: { input: "./src/entry-server.tsx" } },
    },
    client: {
      build: { rollupOptions: { input: "./src/entry-client.tsx" } },
    },
  },
});
