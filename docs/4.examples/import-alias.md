---
navigation:
  category: config
icon: i-lucide-at-sign
---

# Import Alias

> Custom import aliases for cleaner module paths.

<!-- automd:ui-code-tree src="../../examples/import-alias" default="server/routes/index.ts" ignore="README.md,GUIDE.md" expandAll -->

::code-tree{defaultValue="server/routes/index.ts" expandAll}

```ts [fastnode.config.ts]
import { defineConfig } from "fastnode";

export default defineConfig({
  serverDir: true,
});
```

```json [package.json]
{
  "type": "module",
  "imports": {
    "#server/*": "./server/*"
  },
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
  "extends": "fastnode/tsconfig",
  "compilerOptions": {
    "paths": {
      "~server/*": ["./server/*"]
    }
  }
}
```

```ts [vite.config.ts]
import { defineConfig } from "vite";
import { fastnode } from "fastnode/vite";

export default defineConfig({ plugins: [fastnode()] });
```

```ts [server/routes/index.ts]
import { sum } from "~server/utils/math.ts";

import { rand } from "#server/utils/math.ts";

export default () => {
  const [a, b] = [rand(1, 10), rand(1, 10)];
  const result = sum(a, b);
  return `The sum of ${a} + ${b} = ${result}`;
};
```

```ts [server/utils/math.ts]
export function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function sum(a: number, b: number): number {
  return a + b;
}
```

::

<!-- /automd -->

<!-- automd:file src="../../examples/import-alias/README.md" -->

Import aliases like `~` and `#` let you reference modules with shorter paths instead of relative imports.

## Importing Using Aliases

```ts [server/routes/index.ts]
import { sum } from "~server/utils/math.ts";

import { rand } from "#server/utils/math.ts";

export default () => {
  const [a, b] = [rand(1, 10), rand(1, 10)];
  const result = sum(a, b);
  return `The sum of ${a} + ${b} = ${result}`;
};
```

The route imports the `sum` function using `~server/` and `rand` using `#server/`. Both resolve to the same `server/utils/math.ts` file. The handler generates two random numbers and returns their sum.

## Configuration

Aliases can be configured in `package.json` imports field, `compilerOptions.paths` of `tsconfig.json` or the `alias` option of `fastnode.config.ts`.

<!-- /automd -->

## Learn More

- [Configuration](/docs/configuration)
