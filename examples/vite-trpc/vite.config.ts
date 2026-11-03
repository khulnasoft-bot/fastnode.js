import { defineConfig } from "vite";
import { fastnode } from "fastnode/vite";

export default defineConfig({
  plugins: [
    fastnode({
      routes: {
        "/trpc/**": "./server/trpc.ts",
      },
    }),
  ],
});
