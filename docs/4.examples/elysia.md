---
navigation:
  category: backend frameworks
icon: i-skill-icons-elysia-dark
---

# Elysia

> Integrate Elysia with Fastnode using the server entry.

<!-- automd:ui-code-tree src="../../examples/elysia" default="server.ts" ignore="README.md,GUIDE.md" expandAll -->

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
    "elysia": "^1.4.30",
    "fastnode": "latest",
    "rolldown": "latest"
  }
}
```

```ts [server.ts]
import { Elysia } from "elysia";

const app = new Elysia();

app.get("/", () => "Hello, Elysia with Fastnode!");

export default app.compile();
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

<!-- automd:file src="../../examples/elysia/README.md" -->

## Server Entry

```ts [server.ts]
import { Elysia } from "elysia";

const app = new Elysia();

app.get("/", () => "Hello, Elysia with Fastnode!");

export default app.compile();
```

Fastnode auto-detects `server.ts` in your project root and uses it as the server entry. The Elysia app handles all incoming requests, giving you full control over routing and middleware.

Call `app.compile()` before exporting to optimize the router for production.

<!-- /automd -->

## Learn More

- [Server Entry](/docs/server-entry)
- [Elysia Documentation](https://elysiajs.com/)
