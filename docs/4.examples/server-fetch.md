---
navigation:
  category: features
icon: i-lucide-arrow-right-left
---

# Server Fetch

> Internal server-to-server requests without network overhead.

<!-- automd:ui-code-tree src="../../examples/server-fetch" default="routes/index.ts" ignore="README.md,GUIDE.md" expandAll -->

::code-tree{defaultValue="routes/index.ts" expandAll}

```ts [fastnode.config.ts]
import { defineConfig, serverFetch } from "fastnode";

export default defineConfig({
  serverDir: "./",
  hooks: {
    "dev:start": async () => {
      const res = await serverFetch("/hello");
      const text = await res.text();
      console.log("Fetched /hello in fastnode module:", res.status, text);
    },
  },
});
```

```json [package.json]
{
  "type": "module",
  "scripts": {
    "dev": "fastnode dev",
    "build": "fastnode build"
  },
  "devDependencies": {
    "fastnode": "latest",
    "rolldown": "latest"
  }
}
```

```json [tsconfig.json]
{
  "extends": "fastnode/tsconfig"
}
```

```ts [vite.config.ts]
import { defineConfig } from "vite";
import { fastnode } from "fastnode/vite";

export default defineConfig({ plugins: [fastnode()] });
```

```ts [routes/hello.ts]
import { defineHandler } from "fastnode";

export default defineHandler(() => "Hello!");
```

```ts [routes/index.ts]
import { defineHandler } from "fastnode";
import { fetch } from "fastnode";

export default defineHandler(() => fetch("/hello"));
```

::

<!-- /automd -->

<!-- automd:file src="../../examples/server-fetch/README.md" -->

When you need one route to call another, use Fastnode's `fetch` function instead of the global fetch. It makes internal requests that stay in-process, avoiding network round-trips. The request never leaves the server.

## Main Route

```ts [routes/index.ts]
import { defineHandler } from "fastnode";
import { fetch } from "fastnode";

export default defineHandler(() => fetch("/hello"));
```

The index route imports `fetch` from `fastnode` (not the global fetch) and calls the `/hello` route. This request is handled internally without going through the network stack.

## Internal API Route

```ts [routes/hello.ts]
import { defineHandler } from "fastnode";

export default defineHandler(() => "Hello!");
```

A simple route that returns "Hello!". When the index route calls `fetch("/hello")`, this handler runs and its response is returned directly.

<!-- /automd -->

## Learn More

- [Routing](/docs/routing)
