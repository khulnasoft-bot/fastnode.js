import { appendFileSync } from "node:fs";
import { fastnode } from "fastnode/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    fastnode({
      serverDir: "./",
      hooks: {
        close() {
          const log = process.env.FASTNODE_TEST_CLOSE_LOG;
          if (log) {
            appendFileSync(log, "build:close\n");
          }
        },
      },
    }),
  ],
});
