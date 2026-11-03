// https://vitest.dev/guide/environment#custom-environment

/** @type {import("vitest/environments").Environment} */
export default {
  name: "fastnode",
  viteEnvironment: "fastnode",
  setup() {
    return {
      async teardown() {
        // Read the descriptor: the lazy getter (see `vitest-setup.mjs`) would create the app
        const fastnodeApp = Object.getOwnPropertyDescriptor(
          globalThis.__fastnode__ || {},
          "default"
        )?.value;
        try {
          await fastnodeApp?.hooks?.callHook("close");
        } finally {
          delete globalThis.__fastnode__?.default;
        }
      },
    };
  },
};
