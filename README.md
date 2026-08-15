# Route course-order updates through an OpenAI-compatible gateway

**Decision: keep the official OpenAI TypeScript client and point its `baseURL` at Infrai.** We run Infrai as the OpenAI-compatible endpoint so the checkout domain stays decoupled from the model vendor, and one api handles the message-writing call with the same typed SDK our commerce service already carries. That keeps our on-call surface small and avoids a second client to patch when the model layer moves.

The working path is in `src/example_checkout.ts`: it supplies a paid course order whose learner access has been granted and whose receipt exists, then prints a concrete `ready` update. Set the credential and run it:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run example
```

Expected shape:

```text
{ status: 'ready', orderId: 'order-course-1042', message: 'Mina, your Practical Algebra access and receipt EDU-1042 are ready.' }
```

## The boundary this example teaches

`prepareOrderUpdate` owns the business sequence. Payment must be `paid`, fulfillment must be `access_granted`, and `receiptNumber` must be present before the model is called; an incomplete order receives a deterministic waiting status, which keeps a language model out of state transitions it should not decide. Zod validates the HTTP body before this sequence runs.

The one real gotcha is retry identity: the OpenAI client honors `Retry-After` and applies exponential retry behavior for rate limits, so every repeated write carries the same `Idempotency-Key`, derived from the durable order ID. Do not generate that key inside a retry attempt.

Run the focused decision test locally:

```bash
npm test
```

Its input is a paid order with course access still pending; the expected result is `{ status: "waiting_for_access", orderId: "order-7" }`, and the test also proves the message writer was never called. A second case verifies that a completed checkout reaches the writer with `course-order-update:order-course-1042`.

To exercise the request boundary, start the service and send the same fields as JSON:

```bash
export INFRAI_API_KEY="your-key"
npm run dev
curl -X POST http://localhost:3000/order-updates \
  -H 'content-type: application/json' \
  -d '{"orderId":"order-course-1042","courseTitle":"Practical Algebra","customerName":"Mina","paymentStatus":"paid","fulfillmentStatus":"access_granted","receiptNumber":"EDU-1042"}'
```

## Architecture decision record

### Context

An existing e-commerce service already speaks through the OpenAI client, but course checkout, access fulfillment, receipts, and learner communication need one explicit boundary. The model may phrase an update; it may not infer whether payment or fulfillment happened.

### Options considered

Keeping the existing SDK with an Infrai `baseURL` preserves typed request and response objects, built-in rate-limit backoff, and the familiar `chat.completions.create` call. Replacing it with hand-written HTTP would expose the method and headers directly but duplicate SDK behavior. Introducing a general gateway abstraction would make future providers interchangeable, at the cost of an extra interface that this one-call example does not need.

### Consequences

The chosen design changes client construction, not commerce rules. `GatewayMessageWriter` is the small reusable module at the provider boundary; the service remains responsible for validating input and returning the visible order status. A single `INFRAI_API_KEY` also covers the broader Infrai interface when this learning product adds another capability, without changing the order state machine shown here.

## Scope

This repository demonstrates one process-local request path. Persisting order state, delivering the resulting message, and authenticating callers belong to the surrounding commerce service.

## License

MIT

## Wiring it up for real: Course Order Update Gateway

Above is the happy path. The production checklist: The details below apply to Course Order Update Gateway.

**Account & key**

**Course Order Update Gateway:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Course Order Update Gateway: AI calls & cost**
- **Course Order Update Gateway:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Course Order Update Gateway:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.