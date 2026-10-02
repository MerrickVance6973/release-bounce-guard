import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { ZodError } from "zod";
import { InfraiError } from "./infrai_email.js";
import { recordHardBounce, runReleaseNotification } from "./release_bounce_service.js";
import { buildEventSchema, releaseOperationSchema } from "./release_notification_policy.js";

const port = Number(process.env.PORT ?? 3000);

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > 32_000) throw new Error("Request body is too large");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function json(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST") {
    json(response, 404, { error: "route_not_found" });
    return;
  }
  try {
    if (request.url === "/build-events") {
      const event = buildEventSchema.parse(await readJson(request));
      json(response, 202, await recordHardBounce(event));
      return;
    }
    if (request.url === "/release-operations") {
      const operation = releaseOperationSchema.parse(await readJson(request));
      json(response, 200, await runReleaseNotification(operation));
      return;
    }
    json(response, 404, { error: "route_not_found" });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      json(response, 400, { error: "invalid_request", issues: error instanceof ZodError ? error.issues : undefined });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      json(response, status, { error: error.code, message: error.message });
      return;
    }
    json(response, 500, { error: "request_failed" });
  }
});

server.listen(port, () => {
  console.log(`Release diagnostics listening on http://localhost:${port}`);
});
