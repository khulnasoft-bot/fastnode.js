## Server Entry

```ts [server.node.ts]
import Fastify from "fastify";

const app = Fastify();

app.get("/", () => "Hello, Fastify with Fastnode!");

await app.ready();

export default app.routing;
```

Fastnode auto-detects `server.node.ts` in your project root and uses it as the server entry.

Call `await app.ready()` to initialize all registered plugins before exporting. Export `app.routing` (not `app`) to provide Fastnode with the request handler function.

::note
The `.node.ts` suffix indicates this entry is Node.js specific and won't work in other runtimes like Cloudflare Workers or Deno.
::
