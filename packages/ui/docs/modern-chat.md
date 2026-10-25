# Modern chat

Guidance for applications embedding `ModernAgentConversation` from `@vertesia/ui/features`.

## Application control of budget requests

`ModernAgentConversation` accepts `onBudgetRequest` for application policy and
`renderBudgetRequest` for application UI. Either prop suppresses the default token prompt
and budget status text. With neither prop, the existing prompt is used.

```tsx
<ModernAgentConversation
    agentRunId={agentRunId}
    onBudgetRequest={async ({ allocateBudget }) => {
        await allocateBudget(100_000);
    }}
/>
```

The callback runs once per pause while the conversation is mounted and controls are enabled,
including when `hideMessageInput` is set. It does not run during historical playback or for
terminal runs. Remounting the entire conversation can notify again; applications with billing
or external side effects should deduplicate using `agentRunId` and `pause.requestId`.

`renderBudgetRequest` receives an `AgentBudgetRequestContext` with `pause` usage details,
`suggestedTokens`, `allocateBudget(additionalTokens)`, optional `stop()`, `disabled`,
`isSubmitting`, and `error`. Return application JSX or `null`. A callback without a renderer
shows no budget UI. Use a component inside the renderer if your custom UI needs React hooks.

Allocation returns `true` when accepted, or `false` on failure, invalid amounts, disabled
controls, or duplicate submission. After success, controls stay pending until the server
reports allocation. Custom UI owns error presentation and can retry `allocateBudget` after
failure. Callback exceptions are also exposed through `error`; the callback is not retried
automatically. The normal composer returns when the server clears the pause.
