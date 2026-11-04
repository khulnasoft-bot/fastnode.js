import { useKV } from "fastnode/kv";

export default () => {
  const storage = useKV();
  return storage.get("test:key");
};
