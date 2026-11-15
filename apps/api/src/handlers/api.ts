import { streamHandle } from "hono/aws-lambda";
import { createApp } from "../app";
import { createDatabase } from "../platform/database";

const { checkDatabase } = createDatabase();

export const handler = streamHandle(createApp({ checkDatabase }));
