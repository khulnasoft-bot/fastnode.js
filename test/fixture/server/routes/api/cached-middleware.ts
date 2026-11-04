import { defineCachedHandler } from "fastnode/cache";

export default defineCachedHandler(() => "cached", { maxAge: 60 });
