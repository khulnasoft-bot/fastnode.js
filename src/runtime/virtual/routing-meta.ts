import "./_runtime_warn.ts";
import type { FastnodeRouteMeta } from "fastnode/types";

export const handlersMeta: {
  route?: string;
  method?: string;
  meta?: FastnodeRouteMeta;
}[] = [];
