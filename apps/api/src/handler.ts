/**
 * AWS Lambda entrypoint.
 * Uses Hono's AWS Lambda adapter to translate API Gateway v2 events ↔ Fetch API.
 */
import { handle } from "hono/aws-lambda"
import { app } from "./app.js"

export const handler = handle(app)
