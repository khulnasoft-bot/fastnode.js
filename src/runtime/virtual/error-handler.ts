import "./_runtime_warn.ts";
import { H3Event, toResponse } from "h3";
import type { FastnodeErrorHandler } from "fastnode/types";

type EParams = Parameters<FastnodeErrorHandler>;
type EReturn = ReturnType<FastnodeErrorHandler>;

const errorHandler: (error: EParams[0], event: EParams[1]) => EReturn = (error, event) => {
  if (error.status !== 404) {
    console.error(error as any);
  }
  return toResponse(error, event as H3Event);
};

export default errorHandler;
