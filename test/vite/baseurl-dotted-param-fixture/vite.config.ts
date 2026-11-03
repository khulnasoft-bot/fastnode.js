import { defineConfig } from "vite";
import { fastnode } from "fastnode/vite";

const virtualId = "virtual:extensionless-probe";

export default defineConfig({
  base: "/subdir/",
  plugins: [
    {
      name: "extensionless-virtual",
      resolveId(id) {
        return id === virtualId ? "\0" + virtualId : undefined;
      },
      load(id) {
        return id === "\0" + virtualId ? `export const probe = "probe";` : undefined;
      },
    },
    fastnode({
      baseURL: "/subdir/",
      serverDir: "./",
      serveStatic: false,
    }),
  ],
});
