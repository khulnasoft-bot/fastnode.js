import type { Fastnode } from "fastnode/types";
import { normalize } from "pathe";

export default function tasks(fastnode: Fastnode) {
  return {
    id: "#fastnode/virtual/tasks",
    template: () => {
      const _scheduledTasks = Object.entries(fastnode.options.scheduledTasks || {})
        .map(([cron, _tasks]) => {
          const tasks = (Array.isArray(_tasks) ? _tasks : [_tasks]).filter((name) => {
            if (!fastnode.options.tasks[name]) {
              fastnode.logger.warn(`Scheduled task \`${name}\` is not defined!`);
              return false;
            }
            return true;
          });
          return { cron, tasks };
        })
        .filter((e) => e.tasks.length > 0);
      const scheduledTasks: false | { cron: string; tasks: string[] }[] =
        _scheduledTasks.length > 0 ? _scheduledTasks : false;

      return /* js */ `
export const scheduledTasks = ${JSON.stringify(scheduledTasks)};

export const scheduleRunner = ${fastnode.options.scheduler.runner !== false};

export const tasks = {
  ${Object.entries(fastnode.options.tasks)
    .map(
      ([name, task]) =>
        `"${name}": {
          meta: {
            description: ${JSON.stringify(task.description)},
          },
          resolve: ${
            task.handler
              ? /* js */ `() => import("${normalize(task.handler)}").then(r => r.default || r)`
              : "undefined"
          },
        }`
    )
    .join(",\n")}
};`;
    },
  };
}
