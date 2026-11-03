---
navigation:
  category: server side rendering
icon: i-lucide-brackets
---

# Mono JSX

> Server-side JSX rendering in Fastnode with mono-jsx.

<!-- automd:ui-code-tree src="../../examples/mono-jsx" default="server.tsx" ignore="README.md,GUIDE.md" expandAll -->

::code-tree{defaultValue="server.tsx" expandAll}

```ts [fastnode.config.ts]
import { defineConfig } from "fastnode";

export default defineConfig({});
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
    "mono-jsx": "latest",
    "rolldown": "latest"
  }
}
```

```tsx [server.tsx]
export default () => (
  <html>
    <h1>Fastnode + mono-jsx works!</h1>
  </html>
);
```

```json [tsconfig.json]
{
  "extends": "fastnode/tsconfig",
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "mono-jsx"
  }
}
```

```ts [vite.config.ts]
import { defineConfig } from "vite";
import { fastnode } from "fastnode/vite";

export default defineConfig({ plugins: [fastnode()] });
```

::

<!-- /automd -->

<!-- automd:file src="../../examples/mono-jsx/README.md" -->

## Server Entry

```tsx [server.tsx]
export default () => (
  <html>
    <h1>Fastnode + mono-jsx works!</h1>
  </html>
);
```

Fastnode auto-detects `server.tsx` and uses mono-jsx to transform JSX into HTML. Export a function that returns JSX, and Fastnode sends the rendered HTML as the response.

<!-- /automd -->

## Learn More

- [Renderer](/docs/renderer)
- [mono-jsx](https://github.com/aspect-dev/mono-jsx)
