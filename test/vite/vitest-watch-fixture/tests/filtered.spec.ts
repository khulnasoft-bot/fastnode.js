import { appendFileSync } from "node:fs";
import { test } from "vitest";
import { serverFetch } from "fastnode";

// Logs its runs, for the filename filter case in `vitest-watch.test.ts`
test("filtered", async () => {
  await serverFetch("/hello");
  if (process.env.FASTNODE_TEST_WATCH_FILTERED_LOG) {
    appendFileSync(process.env.FASTNODE_TEST_WATCH_FILTERED_LOG, "run\n");
  }
});
