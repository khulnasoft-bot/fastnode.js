import type { Fastnode } from "fastnode/types";

export default function runtimeConfig(fastnode: Fastnode) {
  return {
    id: "#fastnode/virtual/runtime-config",
    template: () => {
      return /* js */ `export const runtimeConfig = ${JSON.stringify(
        fastnode.options.runtimeConfig || {}
      )};`;
    },
  };
}
