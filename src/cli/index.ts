#!/usr/bin/env node
import { defineCommand, runMain } from "citty";
import { version as fastnodeVersion } from "#fastnode/meta";
import { showUsage } from "./_usage.ts";

const main = defineCommand({
  meta: {
    name: "fastnode",
    description: "Fastnode CLI",
    version: fastnodeVersion,
  },
  subCommands: {
    create: () => import("./commands/create/index.ts").then((r) => r.default),
    dev: () => import("./commands/dev.ts").then((r) => r.default),
    build: () => import("./commands/build.ts").then((r) => r.default),
    deploy: () => import("./commands/deploy.ts").then((r) => r.default),
    task: () => import("./commands/task/index.ts").then((r) => r.default),
    preview: () => import("./commands/preview.ts").then((r) => r.default),
    serve: () => import("./commands/serve.ts").then((r) => r.default),
    start: () => import("./commands/serve.ts").then((r) => r.default),
    fetch: () => import("./commands/fetch/index.ts").then((r) => r.default),
    curl: () => import("./commands/fetch/index.ts").then((r) => r.default),
    docs: () => import("./commands/docs.ts").then((r) => r.default),
  },
});

runMain(main, { showUsage });
