---
navigation:
  category: server side rendering
icon: i-lucide-brackets
---

# Nano JSX

> Server-side JSX rendering in Fastnode with nano-jsx.

<!-- automd:ui-code-tree src="../../examples/nano-jsx" default="server.tsx" ignore="README.md,GUIDE.md" expandAll -->

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
    "nano-jsx": "^0.2.1",
    "rolldown": "latest"
  }
}
```

```tsx [server.tsx]
import { defineHandler, html } from "fastnode";
import { renderSSR } from "nano-jsx";

export default defineHandler(() => {
  return html(renderSSR(() => <h1>Fastnode + nano-jsx works!</h1>));
});
```

```json [tsconfig.json]
{
  "extends": "fastnode/tsconfig",
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "nano-jsx/esm"
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

<!-- automd:file src="../../examples/nano-jsx/README.md" -->

## Server Entry

```tsx [server.tsx]
import { defineHandler, html } from "fastnode";
import { renderSSR } from "nano-jsx";

export default defineHandler(() => {
  return html(renderSSR(() => <h1>Fastnode + nano-jsx works!</h1>));
});
```

Fastnode auto-detects `server.tsx` and uses it as the server entry. Use `renderSSR` from nano-jsx to convert JSX into an HTML string. The `html` helper from H3 sets the correct content type header.

<!-- /automd -->

## Learn More

- [Renderer](/docs/renderer)
- [nano-jsx](https://nanojsx.io/)
