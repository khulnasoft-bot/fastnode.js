import { defineConfig } from "fastnode";

export default defineConfig({
  preset: "static",
  prerender: { routes: ["/"] },
});
