export default async () => {
  return {
    dev: import.meta.dev,
    envName: import.meta.envName,
    preset: import.meta.preset,
    prerender: import.meta.prerender,
    fastnode: import.meta.fastnode,
    server: import.meta.server,
    client: import.meta.client,
    baseURL: import.meta.baseURL,
    _asyncContext: import.meta._asyncContext,
    _tasks: import.meta._tasks,
  };
};
