---
name: vertesia-dsl-workflow
description: Reference for DSL workflow definitions, remote activities, variable resolution, and conditions. Use when creating or debugging DSL workflows that call remote activities from plugins.
---

# DSL Workflows & Remote Activities

DSL workflows are declarative step-by-step pipelines defined as JSON. They can call built-in activities and remote activities provided by plugins.

## Key Source Files

| File | Purpose |
|------|---------|
| `composableai/packages/workflow/src/dsl/dsl-workflow.ts` | DSL engine: variable init, step execution, remote activity calls |
| `composableai/packages/workflow/src/dsl/vars.ts` | `Vars` class: variable storage, resolution (`${varName}`), dotted path access |
| `composableai/packages/workflow/src/dsl/conditions.ts` | `matchCondition()`: operator-based condition matching |
| `composableai/packages/workflow/src/activities/getObjectFromStore.ts` | Built-in activity to load a ContentObject into workflow vars |
| `composableai/packages/tools-sdk/src/ActivityCollection.ts` | `ActivityCollection` class for registering plugin activities |

## Workflow Definition Structure

```typescript
await client.workflows.definitions.create({
    name: 'MyWorkflow',
    description: 'Description',
    debug_mode: true,
    steps: [
        { name: 'activityName', type: 'activity', params: { ... } },
        // ...
    ],
    vars: {},  // initial workflow variables
});
```

## Built-in Activities

Common built-in activities available in all DSL workflows:

| Activity | Purpose | Key Params |
|----------|---------|------------|
| `setDocumentStatus` | Set document status | `{ status: 'processing' \| 'completed' \| ... }` |
| `getObjectFromStore` | Load ContentObject into vars | `{ }` (uses objectId automatically) |
| `generateEmbeddings` | Compute embeddings | `{ type: 'text' \| 'properties' }` |

### `getObjectFromStore` Pattern

Use `output` to store the loaded object in a named variable, then access nested fields with dotted paths:

```typescript
{ name: 'getObjectFromStore', type: 'activity', output: 'task' },
// Now 'task' is in vars — access fields as 'task.properties.my_field'
```

## Remote Activities

Plugin activities registered via `ActivityCollection` are invoked as DSL steps using the naming convention:

```
app:<plugin-name>:<collection-name>:<activity-name>
```

Example: `app:bpce-orchestrator:intake:categorize_task`

App interactions used by `executeInteraction` follow a similar pattern:

```
app:<plugin-name>:<collection-name>:<interaction-name>
```

Do not assume a bare interaction name like `ExtractContractMetadata` will resolve inside a workflow if the interaction is contributed by an app.

### Variable Resolution for Remote Activities

**CRITICAL**: Remote activity params are resolved in a **new `Vars` scope** (see `dsl-workflow.ts:422`). Workflow-level variables like `objectId` are NOT automatically available in remote activity params.

You must use `import` to bring workflow variables into scope:

```typescript
// WRONG - ${objectId} will be undefined
{
    name: 'app:my-plugin:collection:my_activity',
    type: 'activity',
    params: { task_id: '${objectId}' },
}

// CORRECT - import brings objectId into the new Vars scope
{
    name: 'app:my-plugin:collection:my_activity',
    type: 'activity',
    import: ['objectId'],
    params: { task_id: '${objectId}' },
    output: 'result',
}
```

The `import` field tells the DSL engine to copy the listed variables from the workflow scope into the activity's `Vars` scope via `vars.createImportVars(activity.import)` at `dsl-workflow.ts:378`.

### How `objectId` is Initialized

At `dsl-workflow.ts:133`, the DSL engine initializes workflow vars with:
- `objectId` = first object ID from the trigger event (`objectIds[0]`)
- Plus any vars defined in the workflow definition's `vars` field

## Conditions on Steps

Use `condition` to skip steps based on workflow variable values.

### Condition Syntax

Conditions use operator objects from `conditions.ts`. The `matchCondition()` function iterates the keys of the condition value and looks them up in the `conditionFns` registry.

**Available operators:**

| Operator | Description | Example |
|----------|-------------|---------|
| `$eq` | Equals | `{ $eq: 'value' }` |
| `$ne` | Not equals | `{ $ne: 'value' }` |
| `$in` | In array | `{ $in: ['a', 'b'] }` |
| `$nin` | Not in array | `{ $nin: ['a', 'b'] }` |
| `$exists` | Field exists | `{ $exists: true }` |
| `$null` | Is null/undefined | `{ $null: true }` |
| `$gt`, `$gte`, `$lt`, `$lte` | Comparisons | `{ $gt: 50 }` |
| `$regexp` | Regex match | `{ $regexp: '^EPR-' }` |
| `$startsWith`, `$endsWith`, `$contains` | String ops | `{ $contains: 'text' }` |
| `$or` | OR conditions | `{ $or: [{ $eq: 'a' }, { $eq: 'b' }] }` |

### CRITICAL: Always Use Operator Objects

**NEVER pass plain values as conditions.** Plain strings/numbers cause `Unknown condition: 0` errors because `matchCondition()` iterates string characters as keys.

```typescript
// WRONG - causes "Unknown condition: 0" error
condition: { 'task.properties.task_status': 'categorisation' }

// CORRECT - use operator object
condition: { 'task.properties.task_status': { $eq: 'categorisation' } }
```

### Dotted Path Access in Conditions

Conditions support dotted paths to access nested variables. The `vars.match()` method uses `getValue(path)` which resolves dotted paths like `task.properties.task_status`:

```typescript
{
    name: 'app:my-plugin:collection:my_activity',
    type: 'activity',
    condition: { 'task.properties.field_name': { $eq: 'expected_value' } },
    import: ['objectId'],
    params: { task_id: '${objectId}' },
}
```

This requires a prior `getObjectFromStore` step with `output: 'task'` to populate the variable.

## Complete Workflow Example

A workflow that loads a task, conditionally processes it, computes embeddings, and sets status:

```typescript
steps: [
    { name: 'setDocumentStatus', type: 'activity', params: { status: 'processing' } },
    { name: 'getObjectFromStore', type: 'activity', output: 'task' },
    {
        name: 'app:my-plugin:intake:categorize_task',
        type: 'activity',
        condition: { 'task.properties.task_status': { $eq: 'categorisation' } },
        import: ['objectId'],
        params: { task_id: '${objectId}' },
        output: 'categorize_result',
    },
    {
        name: 'app:my-plugin:intake:compute_priority',
        type: 'activity',
        condition: { 'task.properties.task_status': { $eq: 'categorisation' } },
        import: ['objectId'],
        params: { task_id: '${objectId}' },
        output: 'priority_result',
    },
    { name: 'generateEmbeddings', type: 'activity', params: { type: 'text' } },
    { name: 'generateEmbeddings', type: 'activity', params: { type: 'properties' } },
    { name: 'setDocumentStatus', type: 'activity', params: { status: 'completed' } },
]
```

## Workflow Rules

Workflow rules trigger workflows based on events. They match on event name and content type:

```typescript
await client.workflows.rules.create({
    name: 'My Rule',
    endpoint: `wf:${workflowDefinitionId}`,
    match: {
        '$and': [
            { 'event.name': 'create' },
            { 'event.data.type.name': 'my_content_type' },
        ]
    },
});
```

When reusing a standard intake workflow such as `StandardDocumentIntake`, prefer staging custom enrichment on a later `update` event after the generic intake marks the object completed. This avoids two workflows racing on the same `create` event.

## Common Pitfalls

1. **`${objectId}` undefined in remote activity params**: Add `import: ['objectId']` to the step
2. **`Unknown condition: 0` error**: Condition value is a plain string, not an operator object — wrap with `{ $eq: ... }`
3. **Condition not matching nested fields**: Ensure a prior `getObjectFromStore` step with `output` set to populate the variable
4. **Activities not found**: Verify the naming convention `app:<plugin-name>:<collection>:<activity>` and that the `ActivityCollection` is registered in `config.ts`
5. **App interaction not found from `executeInteraction`**: Use the full app interaction id `app:<plugin-name>:<collection>:<interaction>`, not a bare interaction name
6. **App child record creation fails with app type not found**: Pass the in-code app type **string** directly to `client.objects.create({ type: 'app:<plugin-name>:<collection>:<Type>', ... })`. Do NOT resolve it to a project-local ObjectId (no `client.types.getTypeByName()`/`types.list` → id); the in-code string is portable and the platform resolves it from the app's package.
7. **Custom CLM/business enrichment races standard intake**: move the custom rule off `create` and trigger on a later `update` condition such as `status=completed`
