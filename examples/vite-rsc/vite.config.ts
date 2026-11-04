import { defineConfig } from "vite";
import { fastnode } from "fastnode/vite";

import rsc from "@vitejs/plugin-rsc";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    fastnode(),
    rsc({
      serverHandler: false,
      entries: {
        ssr: "./app/framework/entry.ssr.tsx",
        rsc: "./app/framework/entry.rsc.tsx",
      },
    }),
    react(),
  ],

  environments: {
    client: {
      build: {
        rollupOptions: {
          input: { index: "./app/framework/entry.browser.tsx" },
        },
      },
    },
  },
});
