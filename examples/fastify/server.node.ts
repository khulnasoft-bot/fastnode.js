import Fastify from "fastify";

const app = Fastify();

app.get("/", () => "Hello, Fastify with Fastnode!");

await app.ready();

export default app.routing;
