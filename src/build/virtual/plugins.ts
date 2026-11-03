import type { Fastnode } from "fastnode/types";
import { hash } from "../../utils/hash.ts";

export default function plugins(fastnode: Fastnode) {
  return {
    id: "#fastnode/virtual/plugins",
    template: () => {
      const fastnodePlugins = [...new Set(fastnode.options.plugins)];

      return /* js */ `
  ${fastnodePlugins.map((plugin) => /* js */ `import _${hash(plugin)} from "${plugin}";`).join("\n")}

  export const plugins = [
    ${fastnodePlugins.map((plugin) => `_${hash(plugin)}`).join(",\n")}
  ]
      `;
    },
  };
}
