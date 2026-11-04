import { defineConfig } from "vite";
import { fastnode } from "fastnode/vite";
import { fileURLToPath } from "node:url";

const runtimeDir = fileURLToPath(new URL("./pkg/runtime", import.meta.url));

export default defineConfig({
  plugins: [fastnode()],
  resolve: {
    // `#pkg` is declared here as well as in `fastnode.config.ts` on purpose: Vite merges two
    // alias objects by key, so a duplicated prefix key is what pulls it ahead of the more
    // specific `#pkg/network-dispatcher`. Removing it removes the regression coverage.
    alias: {
      "#pkg": runtimeDir,
    },
  },
});
