import { defineHandler } from "fastnode/h3";
import { useKV } from "fastnode/kv";

export default defineHandler(async () => {
  await useKV("test").setItem("foo", "bar");
  return { value: await useKV().getItem("test:foo") };
});
