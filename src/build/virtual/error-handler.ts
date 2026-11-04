import type { Fastnode } from "fastnode/types";
import { runtimeDir } from "#fastnode/meta";
import { join } from "pathe";

export default function errorHandler(fastnode: Fastnode) {
  return {
    id: "#fastnode/virtual/error-handler",
    template: () => {
      const errorHandlers = Array.isArray(fastnode.options.errorHandler)
        ? fastnode.options.errorHandler
        : [fastnode.options.errorHandler];

      const builtinHandler = join(
        runtimeDir,
        `internal/error/${fastnode.options.dev ? "dev" : "prod"}`
      );

      return /* js */ `
${errorHandlers.map((h, i) => `import errorHandler$${i} from "${h}";`).join("\n")}

const errorHandlers = [${errorHandlers.map((_, i) => `errorHandler$${i}`).join(", ")}];

import { defaultHandler } from "${builtinHandler}";

export default async function(error, event) {
  for (const handler of errorHandlers) {
    try {
      const response = await handler(error, event, { defaultHandler });
      if (response) {
        return response;
      }
    } catch(error) {
      // Handler itself thrown, log and continue
      console.error(error);
    }
  }
  // H3 will handle fallback
}
`;
    },
  };
}
