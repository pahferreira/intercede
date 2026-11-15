import { streamHandle } from "hono/aws-lambda";
import { createApp } from "../app";
import { createDatabaseProbe, requireDatabaseUrl } from "../platform/database";

const isDatabaseReachable = createDatabaseProbe(requireDatabaseUrl());

export const handler = streamHandle(createApp({ isDatabaseReachable }));
