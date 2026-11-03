import { defineConfig } from "vite";
import { fastnode } from "fastnode/vite";

export default defineConfig({
  build: { outDir: "dist/public" },
  plugins: [fastnode({ output: { dir: "dist" } })],
});
