import { Elysia } from "elysia";

const app = new Elysia();

app.get("/", () => "Hello, Elysia with Fastnode!");

export default app.compile();
