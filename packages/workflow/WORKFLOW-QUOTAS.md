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

Request IDs have fixed length, include execution/operation and method/URL scope, and do not buffer
request bodies. Create/import helpers bind generated keys to input and preserve them across retries.
Agent credentials do not grant trust in caller-supplied quota identities: an ID alone cannot bypass
metering. Endpoint idempotency is still required to avoid duplicate writes; arbitrary writes are not
made exactly once by a request ID. Use separate durable activities for independent mutations where
appropriate. Carry explicit business keys when an operation must span continue-as-new.

Request-observation hooks remain synchronous/fire-and-forget; async logging is not awaited.
Cancellation and activity/request deadlines still stop HTTP work through the workflow fetch wrapper.
