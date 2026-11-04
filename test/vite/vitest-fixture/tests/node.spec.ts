// @vitest-environment node
import { expect, test } from "vitest";

test("per-file environment override", () => {
  expect(globalThis.__fastnode__).toBeUndefined();
});
