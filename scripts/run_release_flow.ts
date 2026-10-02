import { runReleaseNotification } from "../src/release_bounce_service.js";

const recipient = process.env.DEMO_EMAIL_TO;
if (!recipient) throw new Error("DEMO_EMAIL_TO is required");

const release = await runReleaseNotification({
  operationId: "notify-demo-release-42",
  releaseId: "release-42",
  recipient,
  project: "agent-runner",
  version: "2.4.0",
});

console.log(JSON.stringify({ release }, null, 2));
