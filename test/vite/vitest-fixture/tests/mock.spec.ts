import { expect, test, vi } from "vitest";
import { serverFetch } from "fastnode";

vi.mock("../utils/value.ts", () => ({ value: "mocked" }));

test("vi.mock applies to modules imported by fastnode plugins", async () => {
  await serverFetch("/hello");
  expect((globalThis as any).__pluginValue).toBe("mocked");
});
