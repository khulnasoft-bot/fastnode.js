import { defineConfig } from "vite";
import { fastnode } from "fastnode/vite";

import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    fastnode({
      serverDir: "./",
    }),
    tailwindcss(),
  ],
});
