import { defineConfig } from "vite";
import { fastnode } from "fastnode/vite";

export default defineConfig({
  plugins: [
    fastnode({
      serverDir: "./",
      experimental: { openAPI: true },
      openAPI: {
        meta: {
          title: "OpenAPI Test API",
          description: "OpenAPI Test Description",
        },
      },
    }),
  ],
});
