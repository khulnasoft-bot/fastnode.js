import { serverFetch } from "fastnode";

export default async () => {
  const res = await serverFetch("/build/test.txt");
  return {
    status: res.status,
    body: await res.text(),
  };
};
