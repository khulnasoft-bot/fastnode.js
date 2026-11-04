import { runtimeDir } from "#fastnode/meta";
import type { FastnodeOptions } from "fastnode/types";
import { join } from "pathe";
import { resolveFastnodePath } from "../../utils/fs.ts";

export async function resolveErrorOptions(options: FastnodeOptions) {
  if (!options.errorHandler) {
    options.errorHandler = [];
  } else if (!Array.isArray(options.errorHandler)) {
    options.errorHandler = [options.errorHandler];
  }

  options.errorHandler = options.errorHandler.map((h) => resolveFastnodePath(h, options));

  // Always add the default error handler as the last one
  options.errorHandler.push(join(runtimeDir, `internal/error/${options.dev ? "dev" : "prod"}`));
}
