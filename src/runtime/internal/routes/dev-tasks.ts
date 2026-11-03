import { H3, type H3Event } from "h3";
import { runTask } from "../task.ts";

import { scheduledTasks, tasks } from "#fastnode/virtual/tasks";

const taskHandler = async (event: H3Event) => {
  const name = event.context.params?.name;
  const body = (await event.req.json().catch(() => ({}))) as Record<string, unknown>;
  const payload = {
    ...Object.fromEntries(event.url.searchParams.entries()),
    ...((body.payload as Record<string, unknown>) ?? body),
  };
  return await runTask(name!, {
    context: { waitUntil: event.req.waitUntil },
    payload,
  });
};

const app: H3 = new H3()
  .get("/_fastnode/tasks", async () => {
    const _tasks = await Promise.all(
      Object.entries(tasks).map(async ([name, task]) => {
        const _task = await task.resolve?.();
        return [name, { description: _task?.meta?.description }];
      })
    );
    return {
      tasks: Object.fromEntries(_tasks),
      scheduledTasks,
    };
  })
  .get("/_fastnode/tasks/:name", taskHandler)
  .post("/_fastnode/tasks/:name", taskHandler);

export default app;
