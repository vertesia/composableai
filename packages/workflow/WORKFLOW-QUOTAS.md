# Workflow quotas and durable jobs

Workflow starts and HTTP calls consume separate project budgets. An HTTP execute call that starts
several workflows needs one start intent per child; retrying a transport must preserve those intents.

For multi-object execution, use the accepted-job API:

```ts
const job = await client.store.workflows.jobs.create({
    target: { type: 'workflow', name: 'MyWorkflow' },
    object_ids: objectIds,
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    idempotency_key: 'import-2026-11-03',
});
const progress = await client.store.workflows.jobs.retrieve(job.id);
const page = await client.store.workflows.jobs.children(job.id, { limit: 100 });
// page.next is the cursor for the next page.
await client.store.workflows.jobs.revoke(job.id);
```

Acceptance is durable. Reuse the same key and input after an ambiguous response; changing input under
that key is rejected. Child IDs and acknowledged results survive retries. Supply a finite expiry that
covers the intended queue duration. The job uses a bounded grant derived from the original caller;
it cannot gain project-wide authority when that caller's token expires. Revocation stops unfinished
starts and renewals; it does not forcibly terminate children already running. Credentials already
minted remain valid until their short expiry.

`client.store.workflows.usage({ workflow_class: 'conversation' })` returns start-window usage,
occupancy, backlog and confirmed starts as separate quantities. Null usage means unavailable or
incomplete observation, not zero. Check availability/freshness and `start_governance_enabled`.
The CLI exposes `workflows jobs create|get|children|revoke` and `workflows usage`.

Within a Temporal activity, the workflow client disables SDK pacing sleeps and generic retries so
Temporal owns typed quota waits. The default operation identity includes workflow, run, activity and
request order, scoped to method, URL and JSON input. For conditional/reordered calls, use explicit
business phase identities:

```ts
import { withWorkflowOperation } from '@vertesia/workflow';

await withWorkflowOperation(`document:${objectId}:update-title`, () =>
    client.store.objects.update(objectId, { name: 'Updated title' }),
);
```

Choose one stable phase per logical operation. Quota deduplication does not make arbitrary writes
exactly once: use endpoint idempotency keys or separate durable activities for independent mutations.
Continue-as-new creates a new run identity; carry explicit application keys when the same business
operation must span runs. Cancellation/deadlines stop a caller waiting for credential refresh without
cancelling refresh work shared by other callers. Narrow job authority is preserved on every renewal.

Server activation requires compatible workers. A server may keep accepted jobs disabled until its
start-governance setting is enabled; handle a 503 without treating the job as accepted.
