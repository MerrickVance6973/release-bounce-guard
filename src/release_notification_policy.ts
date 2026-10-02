import { z } from "zod";

const email = z.string().trim().email().max(320);
const identifier = z.string().trim().min(1).max(120);

export const buildEventSchema = z.object({
  eventId: identifier,
  buildId: identifier,
  releaseId: identifier,
  recipient: email,
  kind: z.literal("hard_bounce"),
}).strict();

export const releaseOperationSchema = z.object({
  operationId: identifier,
  releaseId: identifier,
  recipient: email,
  project: z.string().trim().min(1).max(100),
  version: z.string().trim().min(1).max(80),
}).strict();

export type BuildEvent = z.infer<typeof buildEventSchema>;
export type ReleaseOperation = z.infer<typeof releaseOperationSchema>;

export type ReleaseDiagnostic =
  | { action: "suppress"; code: "hard_bounce_recorded"; releaseId: string; recipient: string }
  | { action: "skip"; code: "recipient_suppressed"; releaseId: string; recipient: string }
  | { action: "send"; code: "notification_allowed"; releaseId: string; recipient: string };

export function diagnoseBuildEvent(event: BuildEvent): ReleaseDiagnostic {
  return {
    action: "suppress",
    code: "hard_bounce_recorded",
    releaseId: event.releaseId,
    recipient: event.recipient,
  };
}

export function diagnoseReleaseNotification(
  operation: ReleaseOperation,
  suppressed: boolean,
): ReleaseDiagnostic {
  return suppressed
    ? { action: "skip", code: "recipient_suppressed", releaseId: operation.releaseId, recipient: operation.recipient }
    : { action: "send", code: "notification_allowed", releaseId: operation.releaseId, recipient: operation.recipient };
}
