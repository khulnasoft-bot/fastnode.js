import { defineHandler } from "fastnode";
import { greet } from "../utils";

export default defineHandler(() => greet("fastnode"));
