import type { DateString } from "compatx";
import type { ProviderName } from "std-env";
import type { FastnodeConfig } from "./config.ts";

export type { PresetName, PresetNameInput, PresetOptions } from "../presets/index.ts";

export type FastnodePreset = FastnodeConfig | (() => FastnodeConfig);

export interface FastnodePresetMeta {
  name: string;
  stdName?: ProviderName;
  aliases?: string[];
  static?: boolean;
  dev?: boolean;
  compatibilityDate?: DateString;
}
