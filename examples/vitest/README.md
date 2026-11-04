Test your server routes with [Vitest](https://vitest.dev). Vitest picks up the `fastnode()` plugin from `vite.config.ts`, so test files run with the same routes, runtime config and storage as your server, without starting a dev server.

## Routes

```ts [api/hello.ts]
import { defineHandler } from "fastnode";
import { useRuntimeConfig } from "fastnode/runtime-config";

export default defineHandler(() => {
  const { greeting } = useRuntimeConfig();
  return { message: `${greeting} from Fastnode!` };
});
```

```ts [api/visits.ts]
import { defineHandler } from "fastnode";
import { useKV } from "fastnode/kv";

export default defineHandler(async () => {
  const kv = useKV<number>();
  const visits = ((await kv.getItem("visits")) || 0) + 1;
  await kv.setItem("visits", visits);
  return { visits };
});
```

## Tests

```ts [test/api.test.ts]
import { beforeEach, expect, test } from "vitest";
import { serverFetch } from "fastnode";
import { useKV } from "fastnode/kv";

beforeEach(async () => {
  await useKV().removeItem("visits");
});

test("GET /api/hello", async () => {
  const res = await serverFetch("/api/hello");
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ message: "Hello from Fastnode!" });
});

test("GET /api/visits", async () => {
  await serverFetch("/api/visits");
  const res = await serverFetch("/api/visits");
  expect(await res.json()).toEqual({ visits: 2 });
  expect(await useKV().getItem("visits")).toBe(2);
});
```

`serverFetch` sends a request through your Fastnode app in-process. Runtime utilities like `useKV` work in tests too, so you can prepare or inspect state directly.

Run the tests with `vitest`, or `vitest run` for a single run.
