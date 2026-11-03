import { defineHandler } from "fastnode";
import { fetch } from "fastnode";

export default defineHandler(() => fetch("/hello"));
