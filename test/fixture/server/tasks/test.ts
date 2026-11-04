import { defineTask } from "fastnode/task";

export default defineTask({
  meta: {
    description: "task to debug",
  },
  async run(taskEvent) {
    if (taskEvent.payload.wait) {
      await new Promise((resolve) => setTimeout(resolve, Number(taskEvent.payload.wait)));
    }
    if (taskEvent.payload.error) {
      throw new Error("test error");
    }
    return { result: taskEvent };
  },
});
