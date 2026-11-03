import type { FastnodeOptions } from "fastnode/types";
import { resolveCompatibilityDatesFromEnv } from "compatx";

export async function resolveCompatibilityOptions(options: FastnodeOptions) {
  options.compatibilityDate = resolveCompatibilityDatesFromEnv(options.compatibilityDate);
}
