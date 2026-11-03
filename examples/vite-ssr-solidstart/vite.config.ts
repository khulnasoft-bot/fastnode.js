import { defineConfig } from "vite";
import { solidStart } from "@solidjs/start/config";
import { fastnode } from "fastnode/vite";

export default defineConfig({
  plugins: [solidStart(), fastnode()],
});
