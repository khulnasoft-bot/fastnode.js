---
navigation:
  category: server side rendering
icon: i-lucide-code
---

# Custom Renderer

> Build a custom HTML renderer in Fastnode with server-side data fetching.

<!-- automd:ui-code-tree src="../../examples/renderer" default="renderer.ts" ignore="README.md,GUIDE.md" expandAll -->

::code-tree{defaultValue="renderer.ts" expandAll}

```ts [fastnode.config.ts]
import { defineConfig } from "fastnode";

export default defineConfig({
  serverDir: "./",
  renderer: { handler: "./renderer" },
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

```ts [renderer.ts]
import { fetch } from "fastnode";

export default async function renderer({ url }: { req: Request; url: URL }) {
  const apiRes = await fetch("/api/hello").then((res) => res.text());
  return new Response(
    /* html */ `<!DOCTYPE html>
    <html>
    <head>
      <title>Custom Renderer</title>
    </head>
    <body>
      <h1>Hello from custom renderer!</h1>
      <p>Current path: ${url.pathname}</p>
      <p>API says: ${apiRes}</p>
    </body>
    </html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } }
  );
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

::

<!-- /automd -->

<!-- automd:file src="../../examples/renderer/README.md" -->

Create a custom renderer that generates HTML responses with data from API routes. Use Fastnode's internal `fetch` to call routes without network overhead.

## Renderer

```ts [renderer.ts]
import { fetch } from "fastnode";

export default async function renderer({ url }: { req: Request; url: URL }) {
  const apiRes = await fetch("/api/hello").then((res) => res.text());
  return new Response(
    /* html */ `<!DOCTYPE html>
    <html>
    <head>
      <title>Custom Renderer</title>
    </head>
    <body>
      <h1>Hello from custom renderer!</h1>
      <p>Current path: ${url.pathname}</p>
      <p>API says: ${apiRes}</p>
    </body>
    </html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } }
  );
}
```

Configure the renderer with `renderer: { handler: "./renderer" }` in `fastnode.config.ts`, and Fastnode uses it for all non-API routes. The renderer function receives the request URL and returns a `Response`. (Alternatively, if an `index.html` exists in your project root, Fastnode auto-detects it as a renderer template.)

Use `fetch` from `fastnode` to call API routes without network overhead—these requests stay in-process.

## API Route

```ts [api/hello.ts]
import { defineHandler } from "fastnode";

export default defineHandler(() => "Fastnode is amazing!");
```

Define API routes in the `api/` directory. When the renderer calls `fetch("/api/hello")`, this handler runs and returns its response.

<!-- /automd -->

## Learn More

- [Renderer](/docs/renderer)
