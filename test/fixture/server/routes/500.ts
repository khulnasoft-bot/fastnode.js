import { HTTPError } from "fastnode/h3";

export default () => {
  throw new HTTPError({ status: 500, statusText: "Test Error" });
};
