import type { Fastnode, OXCOptions } from "fastnode/types";
import type { Plugin } from "rollup";
import { importOXC } from "../../utils/oxc.ts";
import { RESOLVED_RE as rawModulesRE } from "./raw.ts";

export async function oxc(
  fastnode: Fastnode,
  options: OXCOptions & { sourcemap: boolean; minify: boolean | OXCOptions["minify"] }
): Promise<Plugin> {
  const { transformSync, minifySync } = await importOXC({
    dir: fastnode.options.rootDir,
    paths: fastnode.options.deps?.paths,
  });
  if (options.minify && !minifySync) {
    fastnode.logger.warn(
      "Skipping minification: the `rollup` builder minifies with `rolldown`. Install `rolldown` to enable it."
    );
  }
  return {
    name: "fastnode:oxc",
    transform: {
      filter: {
        // Raw modules are already plain JS holding file contents; no need to transpile
        id: { include: /^(?!.*\/node_modules\/).*\.m?[jt]sx?$/, exclude: rawModulesRE },
      },
      handler(code, id) {
        const res = transformSync(id, code, {
          sourcemap: options.sourcemap,
          tsconfig: false,
          ...options.transform,
        });
        if (res.errors?.length > 0) {
          this.error(res.errors.join("\n"));
        }
        return res;
      },
    },
    renderChunk(code, chunk) {
      if (options.minify && minifySync) {
        return minifySync(chunk.fileName, code, {
          sourcemap: options.sourcemap,
          ...(typeof options.minify === "object" ? options.minify : {}),
        } as Parameters<typeof minifySync>[2]);
      }
      return undefined;
    },
  };
}
