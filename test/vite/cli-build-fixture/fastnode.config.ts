import { appendFileSync } from "node:fs";
import { defineConfig } from "fastnode";

export default defineConfig({
  builder: "vite",
  prerender: { routes: ["/"] },
  hooks: {
    "prerender:init": () => log("prerender:init"),
    close: () => log("close"),
  },
});

function log(event: string) {
  const logFile = process.env.FASTNODE_TEST_CLI_BUILD_LOG;
  if (logFile) {
    appendFileSync(logFile, `${event}\n`);
  }
}
