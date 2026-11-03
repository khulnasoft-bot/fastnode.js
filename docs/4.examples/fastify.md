---
navigation:
  category: backend frameworks
icon: i-simple-icons-fastify
---

# Fastify

> Integrate Fastify with Fastnode using the server entry.

<!-- automd:ui-code-tree src="../../examples/fastify" default="server.node.ts" ignore="README.md,GUIDE.md" expandAll -->

::code-tree{defaultValue="server.node.ts" expandAll}

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
    "fastify": "^5.12.7",
    "fastnode": "latest",
    "rolldown": "latest"
  }
}
```

```ts [server.node.ts]
import Fastify from "fastify";

const app = Fastify();

app.get("/", () => "Hello, Fastify with Fastnode!");

await app.ready();

export default app.routing;
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

<!-- automd:file src="../../examples/fastify/README.md" -->

## Server Entry

```ts [server.node.ts]
import Fastify from "fastify";

const app = Fastify();

app.get("/", () => "Hello, Fastify with Fastnode!");

await app.ready();

export default app.routing;
```

Fastnode auto-detects `server.node.ts` in your project root and uses it as the server entry.

Call `await app.ready()` to initialize all registered plugins before exporting. Export `app.routing` (not `app`) to provide Fastnode with the request handler function.

::note
The `.node.ts` suffix indicates this entry is Node.js specific and won't work in other runtimes like Cloudflare Workers or Deno.
::

<!-- /automd -->

## Learn More

- [Server Entry](/docs/server-entry)
- [Fastify Documentation](https://fastify.dev/)
