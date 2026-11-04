---
navigation:
  category: features
icon: i-lucide-route
---

# API Routes

> File-based API routing with HTTP method support and dynamic parameters.

<!-- automd:ui-code-tree src="../../examples/api-routes" default="api/hello.ts" ignore="README.md,GUIDE.md" expandAll -->

::code-tree{defaultValue="api/hello.ts" expandAll}

```ts [fastnode.config.ts]
import { defineConfig } from "fastnode";

export default defineConfig({
  serverDir: "./",
});
```

```html [index.html]
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>API Routes</title>
  </head>
  <body>
    <h2>API Routes:</h2>
    <ul>
      <li><a href="/api/hello">/api/hello</a></li>
      <li><a href="/api/hello/world">/api/hello/world</a></li>
      <li><a href="/api/test">/api/test</a></li>
    </ul>
  </body>
</html>
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

```ts [api/hello.ts]
import { defineHandler } from "fastnode";

export default defineHandler(() => "Fastnode is amazing!");
```

```ts [api/test.get.ts]
import { defineHandler } from "fastnode";

export default defineHandler(() => "Test get handler");
```

```ts [api/test.post.ts]
import { defineHandler } from "fastnode";

export default defineHandler(async (event) => {
  const body = await event.req.json();
  return {
    message: "Test post handler",
    body,
  };
});
```

```ts [api/hello/[name].ts]
import { defineHandler } from "fastnode";

export default defineHandler((event) => `Hello (param: ${event.context.params!.name})!`);
```

::

<!-- /automd -->

<!-- automd:file src="../../examples/api-routes/README.md" -->

Fastnode supports file-based routing in the `api/` or `routes/` directory. Each file becomes an API endpoint based on its path.

## Basic Route

Create a file in the `api/` directory to define a route. The file path becomes the URL path:

```ts [api/hello.ts]
import { defineHandler } from "fastnode";

export default defineHandler(() => "Fastnode is amazing!");
```

This creates a `GET /api/hello` endpoint.

## Dynamic Routes

Use square brackets `[param]` for dynamic URL segments. Access params via `event.context.params`:

```ts [api/hello/[name].ts]
import { defineHandler } from "fastnode";

export default defineHandler((event) => `Hello (param: ${event.context.params!.name})!`);
```

This creates a `GET /api/hello/:name` endpoint (e.g., `/api/hello/world`).

## HTTP Methods

Suffix your file with the HTTP method (`.get.ts`, `.post.ts`, `.put.ts`, `.delete.ts`, etc.):

### GET Handler

```ts [api/test.get.ts]
import { defineHandler } from "fastnode";

export default defineHandler(() => "Test get handler");
```

### POST Handler

```ts [api/test.post.ts]
import { defineHandler } from "fastnode";

export default defineHandler(async (event) => {
  const body = await event.req.json();
  return {
    message: "Test post handler",
    body,
  };
});
```

<!-- /automd -->

## Learn More

- [Routing](/docs/routing)
