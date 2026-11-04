import { defineHandler, defineLazyEventHandler } from "fastnode/h3";
import { useRequest } from "fastnode/context";
import { Color } from "~lib/color";
import note from "../assets/note.txt" with { type: "text" };
// @ts-ignore
import initWasm, { sum } from "../assets/sum.wasm";

export default defineLazyEventHandler(async () => {
  await initWasm();
  return defineHandler(() => ({
    dev: import.meta.dev,
    enum: Color.Green,
    requestURL: new URL(useRequest().url).pathname,
    text: note.trim(),
    wasm: sum(2, 3),
  }));
});
