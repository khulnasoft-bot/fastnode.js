---
navigation:
  category: features
icon: i-lucide-box
---

# Virtual Routes

> Define routes programmatically using Fastnode's virtual module system.

<!-- automd:ui-code-tree src="../../examples/virtual-routes" default="fastnode.config.ts" ignore="README.md,GUIDE.md" expandAll -->

::code-tree{defaultValue="fastnode.config.ts" expandAll}

```ts [fastnode.config.ts]
import { defineConfig } from "fastnode";

export default defineConfig({
  routes: {
    "/": "#virtual-route",
  },
  virtual: {
    "#virtual-route": () =>
      /* js */ `export default () => new Response("Hello from virtual entry!")`,
  },
});
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

<!-- automd:file src="../../examples/virtual-routes/README.md" -->

Virtual routes let you define handlers as strings in your config instead of creating separate files. This is useful when generating routes dynamically, building plugins, or keeping simple routes inline.

## Configuration

```ts [fastnode.config.ts]
import { defineConfig } from "fastnode";

export default defineConfig({
  routes: {
    "/": "#virtual-route",
  },
  virtual: {
    "#virtual-route": () =>
      /* js */ `export default () => new Response("Hello from virtual entry!")`,
  },
});
```

The `routes` option maps URL paths to virtual module identifiers (prefixed with `#`). The `virtual` option defines the module content as a string or function returning a string. At build time, Fastnode resolves these virtual modules to actual handlers.

There are no route files in this project. The entire handler is defined inline in the config, and Fastnode generates the route at build time.

<!-- /automd -->

## Learn More

- [Routing](/docs/routing)
- [Configuration](/docs/configuration)
