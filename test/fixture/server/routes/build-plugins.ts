import { defineHandler } from "fastnode";
// @ts-ignore
import message from "virtual:build-plugin";

export default defineHandler(() => ({ message, transform: "__BUILD_PLUGIN_TRANSFORM__" }));
