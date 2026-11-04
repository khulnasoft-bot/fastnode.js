import { defineConfig } from "fastnode";

export default defineConfig({
  preset: "cloudflare-module",
  compatibilityDate: "2026-07-01",
  serverDir: ".",
  cloudflare: {
    wranglerEnv: "test",
    wrangler: {
      env: {
        test: {
          vars: { INLINE_VAR: "inline" },
        },
      },
    },
  },
});
