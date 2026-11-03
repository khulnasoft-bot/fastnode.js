import { defineHandler } from "fastnode";
import cjs from "@fixture/fastnode-cjs";

export default defineHandler(() => ({ value: cjs(), runtime: cjs.runtime }));
