import worker from "./base-worker.ts";
import dev from "./fastnode-dev.ts";
import prerender from "./fastnode-prerender.ts";
import serve from "./fastnode-serve.ts";

export default [...worker, ...dev, ...prerender, ...serve] as const;
