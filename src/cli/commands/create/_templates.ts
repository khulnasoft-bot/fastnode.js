import { deps } from "../../../utils/_deps.ts";

export interface ProjectTemplate {
  name: string;
  title: string;
  description: string;
  scripts: Record<string, string>;
  devDependencies: Record<string, string>;
  /** Files by path, in addition to the shared ones. */
  files: Record<string, string>;
}

export const projectTemplates: ProjectTemplate[] = [
  {
    name: "vite",
    title: "Vite",
    description: "full-stack app with a frontend",
    scripts: { dev: "vite dev", build: "vite build", preview: "vite preview" },
    devDependencies: { vite: deps.vite.version },
    files: {
      "AGENTS.md": agentsMD(
        "`index.html` + `app/` are the frontend; `index.html` is also served for any unmatched route. Scripts: `dev` (`vite dev`; `fastnode dev` does not run Vite), `build` (outputs `.output/`), `preview`."
      ),
      "vite.config.ts": `import { defineConfig } from "vite";
import { fastnode } from "fastnode/vite";

export default defineConfig({
  plugins: [fastnode()],
});
`,
      "index.html": `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Fastnode + Vite</title>
  </head>
  <body>
    <h1>Fastnode + Vite</h1>
    <button id="hello">Call /api/hello</button>
    <script type="module" src="/app/main.ts"></script>
  </body>
</html>
`,
      "app/main.ts": `const button = document.querySelector<HTMLButtonElement>("#hello")!;

button.addEventListener("click", async () => {
  const res = await fetch("/api/hello");
  button.textContent = await res.text();
});
`,
    },
  },
  {
    name: "rolldown",
    title: "Rolldown",
    description: "API server, bundled for production",
    scripts: { dev: "fastnode dev", build: "fastnode build", preview: "fastnode preview" },
    devDependencies: { rolldown: deps.rolldown.version },
    files: {
      "AGENTS.md": agentsMD(
        "Scripts: `dev`, `build` (bundles into `.output/`; run with `node .output/server/index.mjs`), `preview`."
      ),
      "public/index.html": landingHTML(),
    },
  },
  {
    name: "runtime",
    title: "Runtime",
    description: "API server without a build step, experimental",
    scripts: { dev: "fastnode dev", start: "fastnode start" },
    devDependencies: {},
    files: {
      "AGENTS.md": agentsMD(
        "Scripts: `dev` and `start` run the `server/` sources directly without a build (experimental `builder: false`; `fastnode build` is not supported)."
      ),
      "fastnode.config.ts": `import { defineConfig } from "fastnode";

export default defineConfig({
  serverDir: "./server",
  builder: false,
});
`,
      "public/index.html": landingHTML(),
    },
  },
];

export const sharedFiles: Record<string, string> = {
  "fastnode.config.ts": `import { defineConfig } from "fastnode";

export default defineConfig({
  serverDir: "./server",
});
`,
  "server/api/hello.ts": `import { defineHandler } from "fastnode";

export default defineHandler(() => {
  return { message: "Hello from Fastnode!" };
});
`,
  "tsconfig.json": `{
  "extends": "fastnode/tsconfig"
}
`,
  ".gitignore": `node_modules
dist
.data
.output
.env
.env.local
`,
};

function landingHTML(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Fastnode</title>
  </head>
  <body>
    <h1>Fastnode</h1>
    <p>Your server is running. Try <a href="/api/hello">/api/hello</a>.</p>
    <p>Edit <code>server/api/hello.ts</code> to get started, or replace this page in <code>public/index.html</code>.</p>
  </body>
</html>
`;
}

function agentsMD(templateNotes: string): string {
  return `This is a [Fastnode](https://fastnode.khulnasoft.com) v3 server project (built on H3 v2). Fastnode v1 differs a lot from v2 and your knowledge is likely outdated: read https://fastnode.khulnasoft.com/llms.txt (index of Markdown docs), especially \`docs/utils.md\` (imports) and \`docs/migration.md\` (v2 differences).

- \`server/\` is the server directory (\`serverDir\`); create subdirectories as needed: \`api/\` (routes under \`/api\`), \`routes/\`, \`middleware/\`, \`plugins/\` and \`assets/\` (server assets). File paths map to URLs: \`server/api/users/[id].get.ts\` is \`GET /api/users/:id\`.
- \`public/\` (project root) holds static files.
- No auto-imports: import \`defineHandler\`, \`HTTPError\`, ... from \`"fastnode"\`, H3 utilities (\`getQuery\`, \`readBody\`, ...) from \`"fastnode/h3"\`, and your own helpers (e.g. \`server/utils/\`) with relative imports.
- Handlers receive an H3 v2 event (\`event.req\` is a web \`Request\`, \`event.url\` a \`URL\`) and return JSON, a string or a \`Response\`.
- ${templateNotes}
- Testing: \`npx fastnode fetch /api/hello\` sends one request to the server sources (or to the running dev server) and prints the response, no build needed (curl-like options: \`-X\`, \`-H\`, \`--json\`, \`-i\`). \`npx fastnode serve\` starts the server from the sources.
`;
}
