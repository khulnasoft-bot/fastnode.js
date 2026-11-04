import type { Fastnode } from "fastnode/types";

export default function polyfills(_fastnode: Fastnode, polyfills: string[]) {
  return {
    id: "#fastnode/virtual/polyfills",
    moduleSideEffects: true,
    template: () => {
      return (
        polyfills.map((p) => /* js */ `import '${p}';`).join("\n") || /* js */ `/* No polyfills */`
      );
    },
  };
}
