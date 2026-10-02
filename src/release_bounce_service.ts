import { infrai } from "./infrai_email.js";
import {
  diagnoseBuildEvent,
  diagnoseReleaseNotification,
  type BuildEvent,
  type ReleaseOperation,
} from "./release_notification_policy.js";

export async function recordHardBounce(event: BuildEvent) {
  const diagnostic = diagnoseBuildEvent(event);
  const current = await infrai.email.suppression.check(event.recipient);
  if (!current.suppressed) {
    await infrai.email.suppression.add(event.recipient, `build-bounce:${event.eventId}`);
  }
  return { buildId: event.buildId, diagnostic };
}

export async function runReleaseNotification(operation: ReleaseOperation) {
  const current = await infrai.email.suppression.check(operation.recipient);
  const diagnostic = diagnoseReleaseNotification(operation, current.suppressed);
  if (diagnostic.action === "skip") return { diagnostic };

  const delivery = await infrai.email.send(
    {
      to: operation.recipient,
      subject: `${operation.project} ${operation.version} released`,
      html: `<p>Release ${operation.releaseId} is ready for ${operation.project} ${operation.version}.</p>`,
    },
    `release-notification:${operation.operationId}`,
  );
  return { diagnostic, messageId: delivery.message_id };
}
