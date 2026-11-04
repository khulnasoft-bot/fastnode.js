import { defineConfig } from "fastnode";
import { fileURLToPath } from "node:url";

export default defineConfig({
  preset: "standard",
  alias: {
    "@aliased": fileURLToPath(new URL("app/aliased.ts", import.meta.url)),
  },
});
