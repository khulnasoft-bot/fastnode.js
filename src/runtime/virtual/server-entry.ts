import "./_runtime_warn.ts";
import type { FastnodeServerEntry } from "fastnode/types";

export const serverEntryOptions: Omit<FastnodeServerEntry, "fetch"> = {};

export const serverEntryExports: Record<string, unknown> = {};

export const builtinWorkerExports: Record<string, unknown> = {};
