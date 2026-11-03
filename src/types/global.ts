import type { FastnodeOptions } from "./config.ts";

export interface FastnodeImportMeta {
  dev?: boolean;
  envName?: string;
  preset?: FastnodeOptions["preset"];
  prerender?: boolean;
  fastnode?: boolean;
  server?: boolean;
  client?: boolean;
  baseURL?: string;
  runtimeConfig?: Record<string, any>;
  _asyncContext?: boolean;
  _tasks?: boolean;
  _websocket?: boolean;
}

declare global {
  interface ImportMeta extends FastnodeImportMeta {}
}

// eslint-disable-next-line unicorn/require-module-specifiers
export type {};
