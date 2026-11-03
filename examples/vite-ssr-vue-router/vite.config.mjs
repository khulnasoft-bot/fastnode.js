import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import devtoolsJson from "vite-plugin-devtools-json";
import { fastnode } from "fastnode/vite";

export default defineConfig((_env) => ({
  plugins: [vue({ exclude: /\?assets/ }), devtoolsJson(), fastnode()],
  environments: {
    client: { build: { rollupOptions: { input: "./app/entry-client.ts" } } },
    ssr: { build: { rollupOptions: { input: "./app/entry-server.ts" } } },
    fastnode: { build: { rollupOptions: { treeshake: { moduleSideEffects: () => false } } } },
  },
}));
