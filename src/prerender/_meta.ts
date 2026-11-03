import type { Fastnode } from "fastnode/types";

export type PrerenderMeta = Record<string, { contentType?: string }>;

const prerenderMetas = new WeakMap<Fastnode, PrerenderMeta>();

export function getPrerenderMeta(fastnode: Fastnode): PrerenderMeta {
  let meta = prerenderMetas.get(fastnode);
  if (!meta) {
    meta = {};
    prerenderMetas.set(fastnode, meta);
  }
  return meta;
}
