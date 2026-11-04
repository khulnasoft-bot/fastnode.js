import { defineConfig } from "vite";
import { fastnode } from "fastnode/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tanstackStart(), viteReact(), tailwindcss(), fastnode()],
  resolve: { tsconfigPaths: true },
  environments: {
    ssr: { build: { rollupOptions: { input: "./server.ts" } } },
  },
});
