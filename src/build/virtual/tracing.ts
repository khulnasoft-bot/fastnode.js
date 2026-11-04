import type { Fastnode } from "fastnode/types";

export default function tracing(fastnode: Fastnode) {
  return {
    id: "#fastnode/virtual/tracing",
    template: () => {
      const { srvx, h3 } = fastnode.options.tracingChannel || {};
      const imports: string[] = [];
      const setup: string[] = [];

      if (srvx) {
        imports.push(`import { tracingPlugin as srvxTracing } from "srvx/tracing";`);
      }
      if (h3) {
        imports.push(`import { tracingPlugin as h3Tracing } from "h3/tracing";`);
        setup.push(`  h3Tracing()(fastnodeApp.h3);`);
      }

      return [
        ...imports,
        `export const tracingSrvxPlugins = [${srvx ? "srvxTracing()" : ""}];`,
        `export default function tracing(fastnodeApp) {`,
        ...setup,
        `};`,
      ].join("\n");
    },
  };
}
