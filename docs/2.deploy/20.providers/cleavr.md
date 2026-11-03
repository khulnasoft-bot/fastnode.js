# Cleavr

> Deploy Fastnode apps to Cleavr.

**Preset:** `cleavr`

:read-more{title="cleavr.io" to="https://cleavr.io"}

::note
Integration with this provider is possible with [zero configuration](/deploy#zero-config-providers).
::

## Set up your web app

In your project, set the Fastnode preset to `cleavr`.

::code-group
```ts [fastnode.config.ts]
import { defineConfig } from "fastnode";

export default defineConfig({
  preset: "cleavr",
});
```
```ts [nuxt.config.ts]
export default defineNuxtConfig({
  fastnode: {
    preset: "cleavr",
  },
});
```
::

Push changes to your code repository.

**In your Cleavr panel:**

1. Provision a new server
2. Add a website, selecting **Nuxt 3** as the app type
3. In web app > settings > Code Repo, point to your project's code repository

You're now all set to deploy your project!
