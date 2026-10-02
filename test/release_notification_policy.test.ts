import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEventSchema,
  diagnoseBuildEvent,
  diagnoseReleaseNotification,
  releaseOperationSchema,
} from "../src/release_notification_policy.js";

test("a hard bounce suppresses the address and blocks the next release notification", () => {
  const event = buildEventSchema.parse({
    eventId: "evt-7",
    buildId: "build-91",
    releaseId: "release-12",
    recipient: "builder@example.com",
    kind: "hard_bounce",
  });
  const operation = releaseOperationSchema.parse({
    operationId: "notify-12",
    releaseId: "release-12",
    recipient: event.recipient,
    project: "compiler-agent",
    version: "1.8.0",
  });

  assert.deepEqual(diagnoseBuildEvent(event), {
    action: "suppress",
    code: "hard_bounce_recorded",
    releaseId: "release-12",
    recipient: "builder@example.com",
  });
  assert.deepEqual(diagnoseReleaseNotification(operation, true), {
    action: "skip",
    code: "recipient_suppressed",
    releaseId: "release-12",
    recipient: "builder@example.com",
  });
});
