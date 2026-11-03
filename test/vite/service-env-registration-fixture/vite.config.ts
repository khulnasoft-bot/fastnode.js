import { defineConfig } from "vite";
import { fastnode } from "fastnode/vite";

export default defineConfig({
  plugins: [
    fastnode(),
    {
      // A slow `options` hook keeps the ssr environment's `init()` pending (the test controls how long).
      name: "slow-ssr-init",
      async options() {
        if (this.environment.name === "ssr") {
          await (globalThis as any).__slowSsrInit?.();
        }
      },
    },
  ],
});
