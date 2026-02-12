# Conversation Theme System

A cascading theme system for `ModernAgentConversation` and all its child components. Provides theme classes across components with per-message-type, per-view-mode, and cascade/self-only controls.

## Quick Start

```tsx
import { ModernAgentConversation } from "@vertesia/ui/features";
import { AgentMessageType } from "@vertesia/common";

<ModernAgentConversation
  run={run}
  theme={{
    messageItem: {
      card: "rounded-lg shadow-sm",
      prose: "text-sm",
      byType: {
        [AgentMessageType.ERROR]: { card: "bg-red-950 border-l-red-500" },
      },
      byViewMode: {
        sliding: { card: "shadow-none py-1" },
      },
    },
    streamingMessage: { card: "border-l-blue-500" },
    toolCallGroup: { toolBadge: "bg-blue-100 text-blue-700" },
    workstreamTabs: { tabActive: "bg-blue-600 text-white" },
    markdownStyles: `.vprose table { border-radius: 8px; }`,
  }}
/>
```

## Architecture

### Priority Chain (lowest to highest)

```
1. Hardcoded defaults     — built into each component
2. Component props        — className, cardClassName, etc. passed by parent components
3. Base theme classes     — theme.messageItem.card (applies to all messages)
4. byType overrides       — theme.messageItem.byType[ERROR].card (per message type)
5. byViewMode overrides   — theme.messageItem.byViewMode.sliding.card (per view mode)
```

Each level overrides the previous via `tailwind-merge` (conflicting classes resolve in favor of higher priority).

### Cascade

Theme classes cascade down the DOM tree. Setting a class on a parent propagates to all descendants:

```tsx
messageItem: {
  root: "font-sans text-sm",   // every element inside MessageItem inherits this
  header: "bg-gray-50",        // only header and its children (icon, sender, timestamp, etc.)
}
```

The cascade tree for each component mirrors its DOM structure. For example, MessageItem:

```
root
└─ card
   ├─ header
   │  ├─ headerLeft
   │  │  ├─ icon
   │  │  ├─ sender
   │  │  └─ badge
   │  └─ headerRight
   │     ├─ timestamp
   │     ├─ copyButton
   │     └─ exportButton
   ├─ content
   │  ├─ body
   │  │  └─ prose
   │  └─ jsonPre
   ├─ artifacts
   │  ├─ artifactsLabel
   │  ├─ artifactImages
   │  └─ artifactButtons
   └─ details
      ├─ detailsToggle
      └─ detailsContent
```

### Self vs Cascade (Escape Hatch)

By default, a string value cascades. Use an object to control behavior:

```tsx
messageItem: {
  // String: cascades to all descendants
  root: "font-mono",

  // Object with self: applies ONLY to this element, does NOT cascade
  card: { self: "border rounded-lg shadow-md" },

  // Object with both: root gets both, children only get cascade part
  root: { cascade: "font-mono text-sm", self: "border-2 p-4" },
}
```

## ConversationTheme Interface

```tsx
interface ConversationTheme {
  conversation?: ModernAgentConversationTheme;  // 7 classes
  planPanel?: PlanPanelTheme;                   // 17 classes
  messageItem?: MessageItemTheme;               // 22 classes + byType + byViewMode
  streamingMessage?: StreamingMessageTheme;     // 12 classes + byViewMode
  toolCallGroup?: ToolCallGroupTheme;           // 16 classes + byViewMode
  batchProgressPanel?: BatchProgressPanelTheme; // 14 classes + byViewMode
  allMessagesMixed?: AllMessagesMixedTheme;     // 5 classes
  workstreamTabs?: WorkstreamTabsTheme;         // 9 classes
  markdownStyles?: string;                      // raw CSS for .vprose overrides
}
```

## Component Theme Class Reference

### ModernAgentConversation (7 classes)

Top-level layout container.

| Class Key | Default Classes | Description |
|-----------|----------------|-------------|
| `root` | `flex flex-col lg:flex-row gap-2 h-full relative overflow-hidden` | Main layout |
| `conversationArea` | `flex flex-col min-h-0 border-0` + responsive width | Chat area |
| `headerWrapper` | `flex-shrink-0` | Header container |
| `emptyState` | `flex-1 flex flex-col items-center justify-center ...` | Pre-message state |
| `inputWrapper` | `flex-shrink-0` | Input area container |
| `planPanel` | `w-full lg:w-1/3 min-h-[50vh] lg:h-full border-t ...` | Plan sidebar |
| `dragOverlay` | `absolute inset-0 ... bg-blue-100/80 ...` | File drop zone |

### MessageItem (22 classes + byType + byViewMode)

Individual agent messages. The most feature-rich themed component.

| Class Key | Default Classes |
|-----------|----------------|
| `root` | `w-full max-w-full` |
| `card` | `border-l-4 bg-white dark:bg-gray-900 mb-4 ...` + dynamic border |
| `header` | `flex items-center justify-between px-4 py-1.5` |
| `headerLeft` | `flex items-center gap-1.5` |
| `icon` | (conditional animate-fadeIn) |
| `sender` | `text-xs font-medium text-muted` |
| `badge` | `text-xs text-muted ml-1` |
| `headerRight` | `flex items-center gap-1.5 print:hidden` |
| `timestamp` | `text-[11px] text-muted/70` |
| `copyButton` | `text-muted/50 hover:text-muted h-5 w-5 p-0` |
| `exportButton` | `text-muted/50 hover:text-muted h-5 w-5 p-0` |
| `content` | `px-4 pb-3 bg-white dark:bg-gray-900 overflow-hidden` |
| `body` | `message-content break-words w-full` |
| `prose` | `vprose prose prose-slate dark:prose-invert ... text-[15px]` |
| `jsonPre` | `text-xs font-mono whitespace-pre-wrap ...` |
| `artifacts` | `mt-3 text-xs` |
| `artifactsLabel` | `font-medium text-muted mb-1` |
| `artifactImages` | `mb-2 flex flex-wrap gap-3` |
| `artifactButtons` | `flex flex-wrap gap-2 print:hidden` |
| `details` | `mt-2 print:hidden` |
| `detailsToggle` | `text-xs text-muted flex items-center` |
| `detailsContent` | `mt-2 p-2 bg-muted border border-mixer-muted/40 rounded text-sm` |

**byType** — override classes per `AgentMessageType`:

```tsx
messageItem: {
  byType: {
    [AgentMessageType.ERROR]: { card: "bg-red-950", content: "text-red-200" },
    [AgentMessageType.ANSWER]: { prose: "text-base leading-relaxed" },
    [AgentMessageType.THOUGHT]: { card: "opacity-70" },
  },
}
```

**byViewMode** — override classes per view mode:

```tsx
messageItem: {
  byViewMode: {
    stacked: { card: "shadow-md" },
    sliding: { card: "shadow-none py-1", prose: "text-sm" },
  },
}
```

### StreamingMessage (12 classes + byViewMode)

Real-time streaming text with reveal animation.

| Class Key | Default Classes |
|-----------|----------------|
| `root` | `w-full max-w-full` |
| `card` | `border-l-4 bg-white dark:bg-gray-900 mb-4 border-l-purple-500 ...` |
| `header` | `flex items-center justify-between px-4 py-1.5` |
| `headerLeft` | `flex items-center gap-1.5` |
| `icon` | `animate-fadeIn` |
| `sender` | `text-xs font-medium text-muted` |
| `badge` | `text-xs text-muted` |
| `headerRight` | `flex items-center gap-2 text-muted` |
| `timestamp` | `text-[11px]` |
| `copyButton` | `size-6 p-0 hover:bg-gray-100 dark:hover:bg-gray-800` |
| `content` | `px-4 pb-3 streaming-content` |
| `prose` | `vprose prose prose-slate dark:prose-invert ... text-[15px]` |

### ToolCallGroup (16 classes + byViewMode)

Grouped tool execution messages with expand/collapse.

| Class Key | Default Classes |
|-----------|----------------|
| `root` | `border-l-4 bg-white dark:bg-gray-900 mb-4 overflow-hidden` + dynamic border |
| `header` | `flex items-center justify-between px-4 py-1.5 cursor-pointer ...` |
| `headerLeft` | `flex items-center gap-1.5` |
| `statusIcon` | (dynamic based on tool status) |
| `sender` | `text-xs font-medium text-muted` |
| `toolSummary` | `text-xs text-purple-600 dark:text-purple-400 font-medium` |
| `headerRight` | `flex items-center gap-1.5` |
| `timestamp` | `text-[11px] text-muted/70` |
| `copyButton` | `text-muted/50 hover:text-muted h-5 w-5 p-0` |
| `itemList` | `px-4 py-1 space-y-0` (collapsed) / `group` (expanded) |
| `item` | `border-b border-gray-100 dark:border-gray-800 last:border-b-0` |
| `itemHeader` | `flex items-start gap-2 py-2 text-xs cursor-pointer ...` |
| `toolBadge` | `text-[10px] px-1.5 py-0.5 rounded-md bg-purple-50 ...` |
| `itemContent` | `px-4 py-2 bg-gray-50/50 dark:bg-gray-800/30` |
| `prose` | `vprose prose prose-slate dark:prose-invert ... text-sm` |
| `itemDetails` | `mt-3 text-xs border rounded p-2 bg-muted/30` |
| `fileDisplay` | `mt-2 flex flex-wrap gap-2` |

### BatchProgressPanel (14 classes + byViewMode)

Batch operation progress display.

| Class Key | Default Classes |
|-----------|----------------|
| `root` | `border-l-4 shadow-md overflow-hidden bg-white dark:bg-gray-900 mb-5` + dynamic border |
| `header` | `flex items-center justify-between px-4 py-2 ... bg-blue-50/50 ...` |
| `headerLeft` | `flex items-center gap-2` |
| `statusIcon` | (dynamic based on batch status) |
| `sender` | `text-xs font-medium text-muted` |
| `toolName` | `text-xs text-blue-600 dark:text-blue-400 font-medium` |
| `progressCount` | `text-xs text-muted` |
| `headerRight` | `flex items-center gap-2` |
| `timestamp` | `text-xs text-muted` |
| `copyButton` | `text-muted` |
| `progressBar` | `px-4 py-2 bg-gray-50/50 dark:bg-gray-800/30` |
| `track` | `flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden` |
| `counters` | `flex items-center gap-2 text-xs` |
| `itemList` | `max-h-64 overflow-y-auto` |
| `item` | `flex items-center gap-2 px-4 py-1.5 text-xs border-b ...` |
| `summary` | `px-4 py-2 text-xs text-muted` |

### AllMessagesMixed (5 classes)

Layout container for the message list.

| Class Key | Default Classes |
|-----------|----------------|
| `root` | `flex-1 min-h-0 h-full w-full max-w-full overflow-y-auto ... flex flex-col ...` |
| `tabsWrapper` | `sticky top-0 z-10` |
| `emptyState` | `flex items-center justify-center h-full text-center py-8` |
| `messageList` | `flex-1 flex flex-col justify-start pb-4 space-y-2 w-full max-w-full` |
| `workingIndicator` | `flex items-center gap-3 pl-4 py-2 border-l-2 border-l-purple-500` |

### WorkstreamTabs (9 classes)

Tab navigation for workstreams with active/inactive state targeting.

| Class Key | Default Classes |
|-----------|----------------|
| `root` | `flex overflow-x-auto space-x-1 mb-2 bg-muted border-b-2 ...` |
| `tab` | `px-2 py-1 text-xs font-medium whitespace-nowrap ...` (base for all) |
| `tabActive` | `bg-info text-info border-b-2 border-info` (active tab override) |
| `tabInactive` | `text-muted hover:bg-muted border-b-2 border-transparent` (inactive) |
| `badgeGroup` | `flex items-center space-x-1` |
| `badge` | `inline-flex items-center justify-center p-1 text-xs rounded-full` (base) |
| `badgeActive` | `bg-info text-info` (active badge override) |
| `badgeInactive` | `bg-muted text-muted` (inactive badge override) |
| `empty` | `py-1` (when no workstreams to show) |

### InlineSlidingPlanPanel (17 classes)

Plan visualization sidebar.

| Class Key | Default Classes |
|-----------|----------------|
| `root` | `h-full shadow-xl border border-muted/20 overflow-hidden` |
| `header` | `flex items-center justify-between p-3 border-b border-muted/20` |
| `title` | `font-bold text-base` |
| `scrollContent` | `p-3 overflow-y-auto` |
| `taskProgress` | `mb-3 p-2 bg-info rounded-md border border-info` |
| `progressTitle` | `text-xs font-medium text-info mb-1` |
| `progressTrack` | `w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5` |
| `progressCount` | `text-xs text-foreground font-medium whitespace-nowrap` |
| `planSelector` | `mb-3 flex items-center justify-between` |
| `stepsContainer` | `rounded-md border border-muted/30` |
| `stepsHeader` | `p-2 border-b border-muted/30 bg-muted` |
| `stepsList` | `divide-y divide-muted/20 max-h-[calc(100vh-350px)] overflow-y-auto` |
| `stepItem` | `flex p-3 my-1` |
| `stepsEmpty` | `p-3 text-center text-muted italic` |
| `workstreams` | `mt-3 rounded-md border border-gray-200 dark:border-gray-800` |
| `workstreamsHeader` | `p-2 border-b ... bg-gray-50 dark:bg-gray-900/50` |
| `workstreamItem` | `flex items-center p-1.5 rounded` + dynamic status bg |

## Markdown Styles

Override the default `.vprose` CSS rules with raw CSS:

```tsx
<ModernAgentConversation
  theme={{
    markdownStyles: `
      .vprose table { border-radius: 8px; overflow: hidden; }
      .vprose thead th { background: #1a1a2e; color: #e0e0ff; }
      .vprose pre { background: #0d1117; border: 1px solid #30363d; }
      .dark .vprose pre { background: #161b22; }
    `,
  }}
/>
```

This CSS is injected after the default `.vprose` styles, so it overrides them.

## Using the Provider Directly

For advanced cases, you can wrap any subtree with `ConversationThemeProvider`:

```tsx
import { ConversationThemeProvider, MessageItem } from "@vertesia/ui/features";

<ConversationThemeProvider theme={myTheme}>
  <MessageItem message={msg} />
</ConversationThemeProvider>
```

## Internal Architecture

### Files

| File | Purpose |
|------|---------|
| `ConversationThemeContext.ts` | `ConversationTheme` interface, context, provider, hook. Re-exports `ThemeClassValue` and `ViewMode` from themeUtils. |
| `themeUtils.ts` | Shared primitives (`ThemeClassValue`, `ViewMode`) and utilities (`buildClassChains`, `resolveClasses`, `mergeResolvedLayer`, `getCascade`, `getSelf`) |
| `resolveMessageItemTheme.ts` | `MessageItemThemeClasses` + `MessageItemTheme` types, cascade tree, resolver (handles byType + byViewMode) |
| `resolveStreamingMessageTheme.ts` | `StreamingMessageThemeClasses` + `StreamingMessageTheme` types, cascade tree, resolver |
| `resolveToolCallGroupTheme.ts` | `ToolCallGroupThemeClasses` + `ToolCallGroupTheme` types, cascade tree, resolver |
| `resolveBatchProgressPanelTheme.ts` | `BatchProgressPanelThemeClasses` + `BatchProgressPanelTheme` types, cascade tree, resolver |
| `resolveAllMessagesMixedTheme.ts` | `AllMessagesMixedThemeClasses` + `AllMessagesMixedTheme` types, cascade tree, resolver |
| `resolveWorkstreamTabsTheme.ts` | `WorkstreamTabsThemeClasses` + `WorkstreamTabsTheme` types, cascade tree, resolver |
| `resolveModernAgentConversationTheme.ts` | `ModernAgentConversationThemeClasses` + `ModernAgentConversationTheme` types, cascade tree, resolver |
| `resolvePlanPanelTheme.ts` | `PlanPanelThemeClasses` + `PlanPanelTheme` types, cascade tree, resolver |

Each resolver file is the **single source of truth** for its component: the `ThemeClasses` interface, cascade tree, and resolve function all live together. Adding a new class key only requires editing that one file.

### How Resolution Works

Each resolver:
1. Defines a **cascade tree** mirroring the component's DOM hierarchy
2. Derives **class chains** from the tree at module load (one-time cost)
3. For each class key, walks the cascade chain collecting ancestor values
4. Layers `byType` (MessageItem only) then `byViewMode` on top
5. Returns a flat `Record<key, string>` consumed by the component

Components call their resolver once per render and use the flat result in `cn(hardcoded, prop, resolved.key)`.

### Adding a New Theme Class

1. Add the field to the component's `ThemeClasses` interface in its resolver file (e.g. `resolveMessageItemTheme.ts`)
2. Add the key to the cascade tree in the same file
3. Wire `cn(hardcoded, resolved.newKey)` on the DOM element in the component
4. Build to verify
