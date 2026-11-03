import fsp from "node:fs/promises";
import { defineFastnodePreset } from "../_utils/preset.ts";
import { join } from "pathe";

const _static = defineFastnodePreset(
  {
    static: true,
    output: {
      dir: "{{ rootDir }}/.output",
      publicDir: "{{ output.dir }}/public",
    },
    prerender: {
      crawlLinks: true,
    },
    commands: {
      preview: "npx serve ./public",
    },
  },
  {
    name: "static" as const,
    static: true,
  }
);

const githubPages = defineFastnodePreset(
  {
    extends: "static",
    commands: {
      deploy: "npx gh-pages --dotfiles -d ./public",
    },
    prerender: {
      routes: [
        "/",
        // https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-custom-404-page-for-your-github-pages-site
        "/404.html",
      ],
    },
    hooks: {
      async compiled(fastnode) {
        await fsp.writeFile(join(fastnode.options.output.publicDir, ".nojekyll"), "");
      },
    },
  },
  {
    name: "github-pages" as const,
    static: true,
  }
);

const gitlabPages = defineFastnodePreset(
  {
    extends: "static",
    prerender: {
      routes: [
        "/",
        // https://docs.gitlab.com/ee/user/project/pages/introduction.html#custom-error-codes-pages
        "/404.html",
      ],
    },
  },
  {
    name: "gitlab-pages" as const,
    static: true,
  }
);

export default [_static, githubPages, gitlabPages] as const;
