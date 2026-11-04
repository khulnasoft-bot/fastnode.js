import fsp from "node:fs/promises";
import { writeFile } from "../_utils/fs.ts";
import { defineFastnodePreset } from "../_utils/preset.ts";
import type { Fastnode } from "fastnode/types";
import { dirname, relative, resolve } from "pathe";

// https://zeabur.com/docs/advanced/serverless-output-format

const zeabur = defineFastnodePreset(
  {
    entry: "./zeabur/runtime/zeabur",
    output: {
      dir: "{{ rootDir }}/.zeabur/output",
      serverDir: "{{ output.dir }}/functions/__fastnode.func",
      publicDir: "{{ output.dir }}/static",
    },
    hooks: {
      async compiled(fastnode: Fastnode) {
        const buildConfigPath = resolve(fastnode.options.output.dir, "config.json");
        const cfg = {
          containerized: false,
          routes: [{ src: ".*", dest: "/__fastnode" }],
        };
        await writeFile(buildConfigPath, JSON.stringify(cfg, null, 2));

        // Write ISR functions
        for (const [key, value] of Object.entries(fastnode.options.routeRules)) {
          if (!value.isr) {
            continue;
          }
          const funcPrefix = resolve(fastnode.options.output.serverDir, ".." + key);
          await fsp.mkdir(dirname(funcPrefix), { recursive: true });
          await fsp.symlink(
            "./" + relative(dirname(funcPrefix), fastnode.options.output.serverDir),
            funcPrefix + ".func",
            "junction"
          );
          await writeFile(
            funcPrefix + ".prerender-config.json",
            JSON.stringify({ type: "Prerender" })
          );
        }
      },
    },
  },
  {
    name: "zeabur" as const,
    stdName: "zeabur",
  }
);

const zeaburStatic = defineFastnodePreset(
  {
    extends: "static",
    output: {
      dir: "{{ rootDir }}/.zeabur/output",
      publicDir: "{{ output.dir }}/static",
    },
    commands: {
      preview: "npx serve ./static",
    },
  },
  {
    name: "zeabur-static" as const,

    static: true,
  }
);

export default [zeabur, zeaburStatic] as const;
