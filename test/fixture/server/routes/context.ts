import { defineEventHandler } from "fastnode/h3";
import { useRequest } from "fastnode/context";

export default defineEventHandler(async () => {
  await Promise.resolve(setTimeout(() => {}, 10));
  return await useTest();
});

function useTest() {
  const url = new URL(useRequest().url);
  return {
    context: {
      path: url.pathname + url.search,
    },
  };
}
