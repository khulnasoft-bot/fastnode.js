---
navigation:
  category: features
icon: i-lucide-plug
---

# Plugins

> Extend Fastnode with custom plugins for hooks and lifecycle events.

<!-- automd:ui-code-tree src="../../examples/plugins" default="server/plugins/test.ts" ignore="README.md,GUIDE.md" expandAll -->

::code-tree{defaultValue="server/plugins/test.ts" expandAll}

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

export default defineHandler(() => "<h1>Hello Fastnode!</h1>");
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

```ts [server/plugins/test.ts]
import { definePlugin } from "fastnode";
import { useFastnodeHooks } from "fastnode/app";

export default definePlugin(() => {
  const hooks = useFastnodeHooks();
  hooks.hook("response", (res) => {
    res.headers.set("content-type", "html; charset=utf-8");
  });
});
```

::

<!-- /automd -->

<!-- automd:file src="../../examples/plugins/README.md" -->

Plugins let you hook into Fastnode's runtime lifecycle. This example shows a plugin that modifies the `Content-Type` header on every response. Create files in `server/plugins/` and they're automatically loaded at startup.

## Defining a Plugin

```ts [server/plugins/test.ts]
import { definePlugin } from "fastnode";
import { useFastnodeHooks } from "fastnode/app";

export default definePlugin(() => {
  const hooks = useFastnodeHooks();
  hooks.hook("response", (res) => {
    res.headers.set("content-type", "html; charset=utf-8");
  });
});
```

The plugin uses `useFastnodeHooks()` to access the hooks system, then registers a `response` hook that runs after every request and receives the outgoing `Response`. Here it sets the content type to HTML, but you could log requests, add security headers, or modify responses in any way.

## Main Handler

```ts [server.ts]
import { defineHandler } from "fastnode";

export default defineHandler(() => "<h1>Hello Fastnode!</h1>");
```

The handler returns HTML without setting a content type. The plugin automatically adds the correct `Content-Type: html; charset=utf-8` header to the response.

<!-- /automd -->

## Learn More

- [Plugins](/docs/plugins)
- [Lifecycle](/docs/lifecycle)
