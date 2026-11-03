import { defineHandler } from "fastnode";
import { version } from "../utils/version.ts";

export default defineHandler(() => `hello ${version}`);
