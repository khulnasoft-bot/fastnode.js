import { defineConfig } from "vite";
import { fastnode } from "fastnode/vite";

export default defineConfig({
  resolve: { alias: { "~vite-alias": import.meta.dirname } },
  plugins: [fastnode()],
});
