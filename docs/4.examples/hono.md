---
navigation:
  category: backend frameworks
icon: i-logos-hono
---

# Hono

> Integrate Hono with Fastnode using the server entry.

<!-- automd:ui-code-tree src="../../examples/hono" default="server.ts" ignore="README.md,GUIDE.md" expandAll -->

::code-tree{defaultValue="server.ts" expandAll}

```ts [fastnode.config.ts]
import { defineConfig } from "fastnode";

export default defineConfig({});
```

```json [package.json]
{
  "type": "module",
  "scripts": {
    "build": "fastnode build",
    "dev": "fastnode dev"
  },
  "devDependencies": {
    "fastnode": "latest",
    "hono": "^4.13.14",
    "rolldown": "latest"
  }
}
```

```ts [server.ts]
import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => {
  return c.text("Hello, Hono with Fastnode!");
});

export default app;
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

::

<!-- /automd -->

<!-- automd:file src="../../examples/hono/README.md" -->

## Server Entry

```ts [server.ts]
import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => {
  return c.text("Hello, Hono with Fastnode!");
});

export default app;
```

Fastnode auto-detects `server.ts` in your project root and uses it as the server entry. The Hono app handles all incoming requests, giving you full control over routing and middleware.

Hono is cross-runtime compatible, so this server entry works across all Fastnode deployment targets including Node.js, Deno, Bun, and Cloudflare Workers.

<!-- /automd -->

## Learn More

- [Server Entry](/docs/server-entry)
- [Hono Documentation](https://hono.dev/)
