import { afterEach, describe, expect, it, vi } from "vitest";
import type { Fastnode, FastnodeOptions } from "fastnode/types";

import {
  getVercelBuildOutputSchedules,
  getVercelScheduleFunction,
  getVercelSchedulesMode,
  getVercelTaskSchedules,
  setupVercelSchedules,
} from "../../src/presets/vercel/schedules.ts";
import { setupVercelSchedulesDev } from "../../src/presets/vercel/dev.ts";

const task = { handler: "./task.ts" };

function options(overrides: Partial<FastnodeOptions> = {}): FastnodeOptions {
  return {
    experimental: { tasks: true },
    tasks: {},
    scheduledTasks: {},
    scheduler: {},
    vercel: {},
    ...overrides,
  } as FastnodeOptions;
}

describe("getVercelTaskSchedules", () => {
  it("emits one schedule per task named after the task", () => {
    const schedules = getVercelTaskSchedules({
      tasks: { cleanup: task, "db:migrate": task, "reports/weekly": task },
      scheduledTasks: {
        "0 3 * * *": ["cleanup", "db:migrate"],
        "0 9 * * 1": "reports/weekly",
      },
    });
    expect(schedules).toEqual([
      { name: "cleanup", schedule: "0 3 * * *", task: "cleanup" },
      { name: "db.migrate", schedule: "0 3 * * *", task: "db:migrate" },
      { name: "reports.weekly", schedule: "0 9 * * 1", task: "reports/weekly" },
    ]);
  });

  it("suffixes tasks scheduled with several cron expressions", () => {
    const schedules = getVercelTaskSchedules({
      tasks: { cleanup: task },
      scheduledTasks: { "0 3 * * *": "cleanup", "0 15 * * *": ["cleanup", "cleanup"] },
    });
    expect(schedules.map((s) => s.name)).toEqual([
      expect.stringMatching(/^cleanup\.[\da-f]{6}$/),
      expect.stringMatching(/^cleanup\.[\da-f]{6}$/),
    ]);
    expect(new Set(schedules.map((s) => s.name)).size).toBe(2);
  });

  it("prefixes names that do not start with a letter or digit", () => {
    const [schedule] = getVercelTaskSchedules({
      tasks: { _internal: task },
      scheduledTasks: { "* * * * *": "_internal" },
    });
    expect(schedule.name).toBe("task-_internal");
  });

  it("skips undefined tasks", () => {
    expect(
      getVercelTaskSchedules({ tasks: {}, scheduledTasks: { "* * * * *": "missing" } })
    ).toEqual([]);
  });

  it("throws when two tasks map to the same schedule name", () => {
    expect(() =>
      getVercelTaskSchedules({
        tasks: { "db:migrate": task, "db.migrate": task },
        scheduledTasks: { "* * * * *": ["db:migrate", "db.migrate"] },
      })
    ).toThrow("both map to the Vercel schedule name `db.migrate`");
  });
});

describe("getVercelSchedulesMode", () => {
  it("requires experimental tasks", () => {
    expect(
      getVercelSchedulesMode(options({ experimental: {}, vercel: { schedules: "private" } }), {})
    ).toBe(false);
  });

  it("prefers the vercel.schedules option", () => {
    expect(
      getVercelSchedulesMode(options({ vercel: { schedules: false } }), {
        FASTNODE_VERCEL_SCHEDULES: "private",
      })
    ).toBe(false);
  });

  it("uses private function targets", () => {
    expect(getVercelSchedulesMode(options({ vercel: { schedules: "private" } }), {})).toBe(
      "private"
    );
    expect(getVercelSchedulesMode(options(), { FASTNODE_VERCEL_SCHEDULES: "private" })).toBe(
      "private"
    );
  });

  it("uses public path targets", () => {
    expect(getVercelSchedulesMode(options({ vercel: { schedules: "public" } }), {})).toBe("public");
    expect(getVercelSchedulesMode(options(), { FASTNODE_VERCEL_SCHEDULES: "PUBLIC" })).toBe(
      "public"
    );
  });

  it("is disabled without the opt-in", () => {
    expect(getVercelSchedulesMode(options(), {})).toBe(false);
    expect(getVercelSchedulesMode(options(), { FASTNODE_VERCEL_SCHEDULES: "0" })).toBe(false);
    expect(getVercelSchedulesMode(options(), { FASTNODE_VERCEL_SCHEDULES: "false" })).toBe(false);
  });

  it("rejects invalid values", () => {
    const invalid = options({ vercel: { schedules: true as unknown as "private" } });
    expect(() => getVercelSchedulesMode(invalid, {})).toThrow(
      "Invalid `vercel.schedules` value: true"
    );
    expect(() => getVercelSchedulesMode(options(), { FASTNODE_VERCEL_SCHEDULES: "1" })).toThrow(
      'Invalid `FASTNODE_VERCEL_SCHEDULES` value: "1"'
    );
  });
});

function createFastnode(
  schedules: "private" | "public" | false = "private",
  overrides: Partial<FastnodeOptions> = {}
): Fastnode {
  return {
    options: options({
      tasks: { cleanup: task },
      scheduledTasks: { "0 3 * * *": "cleanup" },
      vercel: { schedules: schedules },
      virtual: {},
      handlers: [],
      devHandlers: [],
      baseURL: "/",
      ...overrides,
    }),
    logger: { withTag: () => ({ info: vi.fn() }) },
  } as unknown as Fastnode;
}

describe("getVercelBuildOutputSchedules", () => {
  it("targets the private function", () => {
    expect(getVercelBuildOutputSchedules(createFastnode())).toEqual({
      cleanup: { schedule: "0 3 * * *", function: "_vercel/tasks" },
    });
  });

  it("targets the cron handler route in path mode", () => {
    expect(getVercelBuildOutputSchedules(createFastnode("public"))).toEqual({
      cleanup: { schedule: "0 3 * * *", path: "/_vercel/cron", requestMethod: "GET" },
    });
    const fastnode = createFastnode("public", {
      vercel: { schedules: "public", cronHandlerRoute: "/api/cron" },
    });
    expect(getVercelBuildOutputSchedules(fastnode)).toEqual({
      cleanup: { schedule: "0 3 * * *", path: "/api/cron", requestMethod: "GET" },
    });
  });

  it("is empty without the opt-in", () => {
    expect(getVercelBuildOutputSchedules(createFastnode(false))).toEqual({});
  });

  it("includes the baseURL in function and path targets", () => {
    expect(getVercelBuildOutputSchedules(createFastnode("private", { baseURL: "/app/" }))).toEqual({
      cleanup: { schedule: "0 3 * * *", function: "app/_vercel/tasks" },
    });
    expect(getVercelBuildOutputSchedules(createFastnode("public", { baseURL: "/app/" }))).toEqual({
      cleanup: { schedule: "0 3 * * *", path: "/app/_vercel/cron", requestMethod: "GET" },
    });
  });
});

describe("getVercelScheduleFunction", () => {
  it("describes the private function, with only it allowed to run tasks", () => {
    const fastnode = createFastnode("private", {
      vercel: {
        schedules: "private",
        functionRules: { "/_vercel/tasks": { maxDuration: 60, environment: { FOO: "bar" } } },
      },
    });
    expect(getVercelScheduleFunction(fastnode)).toEqual({
      functionPath: "_vercel/tasks",
      overrides: {
        maxDuration: 60,
        experimentalTriggers: [{ type: "schedule/v1beta" }],
        environment: { FOO: "bar", FASTNODE_VERCEL_SCHEDULES_FUNCTION: "1" },
      },
    });
  });

  it("is undefined in path mode, without the opt-in, or without scheduled tasks", () => {
    expect(getVercelScheduleFunction(createFastnode("public"))).toBeUndefined();
    expect(getVercelScheduleFunction(createFastnode(false))).toBeUndefined();
    expect(
      getVercelScheduleFunction(createFastnode("private", { scheduledTasks: {} }))
    ).toBeUndefined();
  });
});

describe("setupVercelSchedules", () => {
  it("registers a private function with the schedule trigger", () => {
    const fastnode = createFastnode("private", {
      vercel: {
        schedules: "private",
        functionRules: { "/_vercel/tasks": { maxDuration: 60 } },
      },
    });
    setupVercelSchedules(fastnode);
    expect(fastnode.options.handlers).toEqual([
      expect.objectContaining({
        route: "/_vercel/tasks",
        handler: "#fastnode/virtual/vercel-schedule-handler",
      }),
    ]);
    // The private function is written without a public route, not through `functionRules`
    expect(fastnode.options.vercel!.functionRules!["/_vercel/tasks"]).toEqual({ maxDuration: 60 });
    const template = fastnode.options.virtual[
      "#fastnode/virtual/vercel-schedule-handler"
    ] as () => string;
    expect(template()).toContain(
      `createScheduleHandler({"cleanup":"cleanup"}, {"functionEnv":"FASTNODE_VERCEL_SCHEDULES_FUNCTION"})`
    );
  });

  it("rejects function rules with their own triggers", () => {
    const fastnode = createFastnode("private", {
      vercel: {
        schedules: "private",
        functionRules: {
          "/_vercel/tasks": { experimentalTriggers: [{ type: "queue/v2beta", topic: "x" }] },
        },
      },
    });
    expect(() => setupVercelSchedules(fastnode)).toThrow("cannot set `experimentalTriggers`");
  });

  it("serves the cron handler in path mode", () => {
    const fastnode = createFastnode("public");
    setupVercelSchedules(fastnode);
    expect(fastnode.options.handlers).toEqual([
      expect.objectContaining({ route: "/_vercel/cron" }),
    ]);
    expect(fastnode.options.vercel!.functionRules).toBeUndefined();
  });

  it("does nothing without scheduled tasks", () => {
    const fastnode = createFastnode("private", { scheduledTasks: {} });
    setupVercelSchedules(fastnode);
    expect(fastnode.options.handlers).toEqual([]);
  });
});

describe("setupVercelSchedulesDev", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps the in-process scheduler without the vercel dev broker", () => {
    vi.stubEnv("VERCEL_SCHEDULE_DEV_API_VERSION", undefined);
    const fastnode = createFastnode("private", { dev: true });
    setupVercelSchedulesDev(fastnode);
    expect(fastnode.options.scheduler.runner).toBeUndefined();
    expect(fastnode.options.handlers).toEqual([]);
  });

  it("hands scheduling over to the vercel dev broker", async () => {
    vi.stubEnv("VERCEL_SCHEDULE_DEV_API_VERSION", "1");
    const fastnode = createFastnode("private", { dev: true });
    setupVercelSchedulesDev(fastnode);
    expect(fastnode.options.scheduler.runner).toBe(false);
    expect(fastnode.options.scheduledTasks).toEqual({ "0 3 * * *": "cleanup" });
    expect(fastnode.options.handlers).toEqual([
      expect.objectContaining({
        route: "/_vercel/dev-manifest",
        method: "GET",
        handler: "#fastnode/virtual/vercel-dev-manifest",
      }),
      expect.objectContaining({
        route: "/_vercel/tasks",
        handler: "#fastnode/virtual/vercel-schedule-handler",
      }),
    ]);
    const template = fastnode.options.virtual[
      "#fastnode/virtual/vercel-schedule-handler"
    ] as () => string;
    expect(template()).toContain(`createScheduleHandler({"cleanup":"cleanup"}, {})`);
  });

  it("restricts the dev routes to local requests", () => {
    vi.stubEnv("VERCEL_SCHEDULE_DEV_API_VERSION", "1");
    const fastnode = createFastnode("private", { baseURL: "/app/", dev: true });
    setupVercelSchedulesDev(fastnode);
    expect(fastnode.options.devHandlers.map((h) => [h.route, h.middleware])).toEqual([
      ["/app/_vercel/dev-manifest", true],
      ["/app/_vercel/dev-manifest/**", true],
      ["/app/_vercel/tasks", true],
      ["/app/_vercel/tasks/**", true],
    ]);
    const assertLocal = fastnode.options.devHandlers[0].handler as (event: unknown) => void;
    const event = (ip: string) => ({
      req: Object.assign(new Request("http://localhost/app/_vercel/tasks"), { ip }),
      runtime: { node: { req: { socket: { remoteAddress: ip } } } },
    });
    expect(() => assertLocal(event("127.0.0.1"))).not.toThrow();
    expect(() => assertLocal(event("192.168.1.20"))).toThrow("Forbidden IP");
  });

  it("serves the dev manifest for vercel dev", () => {
    vi.stubEnv("VERCEL_SCHEDULE_DEV_API_VERSION", "1");
    const fastnode = createFastnode("private", { dev: true });
    setupVercelSchedulesDev(fastnode);
    const template = fastnode.options.virtual[
      "#fastnode/virtual/vercel-dev-manifest"
    ] as () => string;
    expect(template()).toContain(
      `export default () => (${JSON.stringify({
        functions: [
          {
            outputPath: "_vercel/tasks",
            invocation: { type: "http", pathname: "/_vercel/tasks" },
            experimentalTriggers: [{ type: "schedule/v1beta" }],
          },
        ],
        schedules: { cleanup: { schedule: "0 3 * * *", function: "_vercel/tasks" } },
      })});`
    );
  });

  it("serves an empty dev manifest without the opt-in", () => {
    vi.stubEnv("VERCEL_SCHEDULE_DEV_API_VERSION", "1");
    const fastnode = createFastnode(false, { dev: true });
    setupVercelSchedulesDev(fastnode);
    expect(fastnode.options.scheduler.runner).toBeUndefined();
    expect(fastnode.options.handlers).toEqual([
      expect.objectContaining({ route: "/_vercel/dev-manifest" }),
    ]);
    const template = fastnode.options.virtual[
      "#fastnode/virtual/vercel-dev-manifest"
    ] as () => string;
    expect(template()).toContain(`export default () => ({"functions":[],"schedules":{}});`);
  });

  it("serves the cron handler for path targets", () => {
    vi.stubEnv("VERCEL_SCHEDULE_DEV_API_VERSION", "1");
    const fastnode = createFastnode("public", { dev: true });
    setupVercelSchedulesDev(fastnode);
    expect(fastnode.options.scheduler.runner).toBe(false);
    expect(fastnode.options.handlers).toEqual([
      expect.objectContaining({ route: "/_vercel/dev-manifest" }),
      expect.objectContaining({ route: "/_vercel/cron" }),
    ]);
    const template = fastnode.options.virtual[
      "#fastnode/virtual/vercel-schedule-handler"
    ] as () => string;
    expect(template()).toContain(`createCronHandler({"cleanup":"cleanup"}, {})`);
    expect(fastnode.options.devHandlers.map((h) => h.route)).toContain("/_vercel/cron");
  });
});
