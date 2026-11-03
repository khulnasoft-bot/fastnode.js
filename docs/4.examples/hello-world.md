---
navigation:
  category: features
icon: i-lucide-sparkles
---

# Hello World

> Minimal Fastnode server using the web standard fetch handler.

<!-- automd:ui-code-tree src="../../examples/hello-world" default="server.ts" ignore="README.md,GUIDE.md" expandAll -->

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
    "dev": "fastnode dev",
    "preview": "node .output/server/index.mjs"
  },
  "devDependencies": {
    "fastnode": "latest",
    "rolldown": "latest"
  }
}
```

```ts [server.ts]
export default {
  fetch(req: Request) {
    return new Response("Fastnode Works!");
  },
};
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

<!-- automd:file src="../../examples/hello-world/README.md" -->

The simplest Fastnode server. Export an object with a `fetch` method that receives a standard `Request` and returns a `Response`. No frameworks, no abstractions, just the web platform.


## Server Entry

```ts [server.ts]
export default {
  fetch(req: Request) {
    return new Response("Fastnode Works!");
  },
};
```

The `fetch` method follows the same signature as Service Workers and Cloudflare Workers. This pattern works across all deployment targets because it uses web standards.

Add the Fastnode plugin to Vite and it handles the rest: dev server, hot reloading, and production builds.

<!-- /automd -->

## Learn More

- [Server Entry](/docs/server-entry)
- [Configuration](/docs/configuration)
