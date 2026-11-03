import { fetchViteEnv } from "fastnode/vite/runtime";

/** @param {{ req: Request }} HTTPEvent */
export default function ssrRenderer({ req }) {
  return fetchViteEnv("ssr", req);
}
