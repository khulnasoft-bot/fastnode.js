---
navigation:
  category: backend frameworks
icon: i-simple-icons-express
---

# Express

> Integrate Express with Fastnode using the server entry.

<!-- automd:ui-code-tree src="../../examples/express" default="server.node.ts" ignore="README.md,GUIDE.md" expandAll -->

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
    "@types/express": "^5.0.6",
    "express": "^5.3.0",
    "fastnode": "latest",
    "rolldown": "latest"
  }
}
```

```ts [server.node.ts]
import Express from "express";

const app = Express();

app.use("/", (_req, res) => {
  res.send("Hello from Express with Fastnode!");
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

<!-- automd:file src="../../examples/express/README.md" -->

## Server Entry

```ts [server.node.ts]
import Express from "express";

const app = Express();

app.use("/", (_req, res) => {
  res.send("Hello from Express with Fastnode!");
});

export default app;
```

Fastnode auto-detects `server.node.ts` in your project root and uses it as the server entry. The Express app handles all incoming requests, giving you full control over routing and middleware.

::note
The `.node.ts` suffix indicates this entry is Node.js specific and won't work in other runtimes like Cloudflare Workers or Deno.
::

<!-- /automd -->

## Learn More

- [Server Entry](/docs/server-entry)
- [Express Documentation](https://expressjs.com/)
