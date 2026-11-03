---
navigation:
  category: features
icon: i-lucide-layers
---

# Middleware

> Request middleware for authentication, logging, and request modification.

<!-- automd:ui-code-tree src="../../examples/middleware" default="server/middleware/auth.ts" ignore="README.md,GUIDE.md" expandAll -->

::code-tree{defaultValue="server/middleware/auth.ts" expandAll}

```ts [fastnode.config.ts]
import { defineConfig } from "fastnode";

export default defineConfig({
  serverDir: true,
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

```ts [server.ts]
import { defineHandler } from "fastnode";

export default defineHandler((event) => ({
  auth: event.context.auth,
}));
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

```ts [server/middleware/auth.ts]
import { defineMiddleware } from "fastnode";

export default defineMiddleware((event) => {
  event.context.auth = { name: "User " + Math.round(Math.random() * 100) };
});
```

::

<!-- /automd -->

<!-- automd:file src="../../examples/middleware/README.md" -->

Middleware functions run before route handlers on every request. They can modify the request, add context, or return early responses.

## Defining Middleware

Create files in `server/middleware/`. They run in alphabetical order:

```ts [server/middleware/auth.ts]
import { defineMiddleware } from "fastnode";

export default defineMiddleware((event) => {
  event.context.auth = { name: "User " + Math.round(Math.random() * 100) };
});
```

Middleware can:
- Add data to `event.context` for use in handlers
- Return a response early to short-circuit the request
- Modify request headers or other properties

## Accessing Context in Handlers

Data added to `event.context` in middleware is available in all subsequent handlers:

```ts [server.ts]
import { defineHandler } from "fastnode";

export default defineHandler((event) => ({
  auth: event.context.auth,
}));
```

<!-- /automd -->

## Learn More

- [Routing](/docs/routing)
