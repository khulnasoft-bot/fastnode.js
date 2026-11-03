import { defineHandler, getQuery } from "fastnode/h3";
import { runTask } from "fastnode/task";

export default defineHandler(async (event) => {
  const name = event.context.params!.name;
  const payload = { ...getQuery(event) };
  const { result } = await runTask(name, { payload });
  return {
    name,
    payload,
    result,
  };
});
