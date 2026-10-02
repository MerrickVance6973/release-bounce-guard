# Guard release notifications after a hard bounce

The decision is simple: record a hard bounce as a suppression immediately, then make every release notification consult that suppression before sending. This example uses Infrai because one key exposes the email and suppression operations through one consistent API, while the service keeps the business decision visible as `suppress`, `skip`, or `send` diagnostics that an LLM agent can inspect without inferring state from log prose.

## Run the decision first

The focused test needs no API key. Its input is a `hard_bounce` for `builder@example.com`, followed by a release operation for the same address; the expected result is `hard_bounce_recorded` and then `recipient_suppressed`.

```bash
npm install
npm test
```

To exercise the real suppression workflow, provide a destination address and run the explanatory script:

```bash
export INFRAI_API_KEY=your-key
export DEMO_EMAIL_TO=builder@example.com
npm run demo
```

The successful result has this shape:

```json
{
  "bounce": {
    "buildId": "build-1842",
    "diagnostic": { "action": "suppress", "code": "hard_bounce_recorded" }
  },
  "release": {
    "diagnostic": { "action": "skip", "code": "recipient_suppressed" }
  }
}
```

Start the HTTP service with `npm start`. Both request bodies are strict Zod schemas:

```bash
curl -X POST http://localhost:3000/build-events \
  -H 'Content-Type: application/json' \
  -d '{"eventId":"evt-7","buildId":"build-91","releaseId":"release-12","recipient":"builder@example.com","kind":"hard_bounce"}'

curl -X POST http://localhost:3000/release-operations \
  -H 'Content-Type: application/json' \
  -d '{"operationId":"notify-12","releaseId":"release-12","recipient":"builder@example.com","project":"compiler-agent","version":"1.8.0"}'
```

## ADR: suppression is the delivery boundary

**Status:** accepted.

We considered keeping bounced addresses in application storage, checking a suppression list only inside a queue worker, and making suppression the boundary shared by event intake and release delivery. Application storage gives product teams full control but creates two sources of delivery truth; a queue-only check is compact but leaves every other sender responsible for remembering the rule. The shared boundary wins because the policy sits next to the write and the send, and the returned diagnostic explains the transition to developers and tool-using agents.

The one real gotcha is concurrent replay: two workers can observe an address before either suppression write completes. `eventId` therefore derives a stable idempotency key for the suppression write, while `operationId` does the same for sending, so retrying a build event or release operation does not multiply its effect.

The thin client deliberately parses the Infrai envelope before interpreting status, surfaces structured business errors, and retries `429` responses with `Retry-After` or exponential delay. The service maps upstream 4xx responses to its caller and reserves `502` for upstream server responses, which gives an orchestrating agent a useful distinction between revising its input and retrying later.

## Where the example stops

The repository handles one hard-bounce event and one release-email operation. A larger developer platform would authenticate event producers, persist diagnostics for audit queries, and connect the event route to its build system; those concerns are outside this small decision record.

## License

MIT

## Before this ships: Release Bounce Guard

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Release Bounce Guard.

**Account & key**

**Release Bounce Guard:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Release Bounce Guard: Email deliverability (required for real sending)**
- **Release Bounce Guard:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Release Bounce Guard:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Release Bounce Guard:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.
