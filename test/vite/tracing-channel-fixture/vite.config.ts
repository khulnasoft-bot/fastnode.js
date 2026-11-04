import { fastnode } from "fastnode/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [fastnode({ serverDir: "./", tracingChannel: true })],
});
