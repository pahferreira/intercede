import { streamHandle } from "hono/aws-lambda";
import { app } from "../app";

// Lambda Function URL entry point with response streaming (ADR-0002).
export const handler = streamHandle(app);
