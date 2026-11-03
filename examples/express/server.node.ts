import Express from "express";

const app = Express();

app.use("/", (_req, res) => {
  res.send("Hello from Express with Fastnode!");
});

export default app;
