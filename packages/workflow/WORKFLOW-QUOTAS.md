# Workflow quotas and durable retries

Workflow starts and HTTP calls consume separate project budgets. Workflow-name execution, agents and
processes normally start one workflow per request. This SDK adds usage reporting and retry controls;
it adds no accepted-job or batch-execution API.

`client.store.workflows.usage({ workflow_class: 'conversation' })` reports start-window usage,
occupancy, backlog and confirmed starts separately. Null means unavailable or incomplete observation,
not zero. Check availability, freshness and `start_governance_enabled`. The CLI exposes `workflows usage`.

Public SDK users retain default pacing retries. A worker that installs a durable quota retry interceptor
can opt in by wrapping **each activity attempt** in `withWorkflowHttpExecution`. This disables SDK pacing
and generic retry loops for that attempt and shares counters across all clients its helpers construct.
Without that wrapper, the SDK does not assume the worker has durable quota retry support.

```ts
import { withWorkflowHttpExecution, withWorkflowOperation } from '@vertesia/workflow';

// Inside an activity interceptor that owns typed quota/dependency retry delays:
return withWorkflowHttpExecution(() => next(input));

// Inside the activity, use stable phases for conditional/reordered operations:
await withWorkflowOperation(`document:${objectId}:update-title`, () =>
    client.store.objects.update(objectId, { name: 'Updated title' }),
);
```

For trusted backend service-account credentials inside the opted-in activity scope, request IDs have fixed length and include execution/operation, method/URL, serialized-body hash and
occurrence. They are allocated before authentication and reused for transport retries. Already
serialized bodies are hashed directly; requests/streams are not cloned or buffered. Create/import helpers bind generated keys to input and preserve them across retries.
Agent credentials do not grant trust in caller-supplied quota identities: an ID alone cannot bypass
metering, and the SDK does not install a body-hashing identity provider for those credentials. Endpoint idempotency is still required to avoid duplicate writes; arbitrary writes are not
made exactly once by a request ID. Use separate durable activities for independent mutations where
appropriate. Carry explicit business keys when an operation must span continue-as-new.

Request-observation hooks remain synchronous/fire-and-forget; async logging is not awaited.
Cancellation and activity/request deadlines still stop HTTP work through the workflow fetch wrapper.


For imports spanning continue-as-new or newly scheduled activities, persist either the explicit
`import_id` or the original operation timestamp in workflow state:

```ts
await withWorkflowOperation('batch-7:import', () => client.store.data.import(storeId, payload), {
    createdAtMs: operationCreatedAtMs, // carry this same value across continue-as-new
});
```

Named imports without that timestamp must supply `import_id`; otherwise the SDK rejects them rather
than silently generating a different ID in a later run. Unnamed imports preserve the original activity
schedule timestamp and are stable across retries of that activity. The server rejects an unknown
import ID older than 24 hours: if the first attempt never reached the server, a retained timestamp
can therefore expire; start a new logical import with a fresh timestamp rather than retrying that
expired ID indefinitely. Use distinct named phases for
independent mutations, particularly concurrent identical requests.

Typed admission dependency outages are exposed as `error.dependencyUnavailable`, separately from the
existing `error.rateLimit` pacing/quota union. This prevents quota-exhaustion UI from mislabelling a 503.
Async request-observation promise rejections are handled without blocking or failing HTTP dispatch;
identity generation uses the separate synchronous `requestIdentity` provider.
