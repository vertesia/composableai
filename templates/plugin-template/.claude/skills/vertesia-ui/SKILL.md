---
name: vertesia-ui
description: Reference for building UIs with @vertesia/ui. Covers component API (Input, Button, VModal, VTabs, Table), list/detail tables with infinite scroll, sortable headers, FilterProvider with URL persistence and inline row filters, layout (Sidebar, FullHeightLayout, GenericPageNavHeader), routing (NestedRouterProvider, useParams, useNavigate), agent conversation (ModernAgentConversation), styling, and security. Use when creating or modifying React UI pages or components.
---

# Vertesia UI Development

React UI built with React 19, Tailwind CSS 4, and `@vertesia/ui` components.

For the full component API reference, see also `composableai/packages/ui/llms.txt` (shipped with the npm package).

For a reusable list/detail table example with backend search, sort, facets, inline filters, and back-navigation preservation, see `references/generic-table-pattern.md`.

## Required First Step: Component Inventory

Before writing or refactoring UI code, explicitly check whether `@vertesia/ui` already provides the surface you need.

At minimum, search for an existing component in these buckets:

- `@vertesia/ui/core`
- `@vertesia/ui/layout`
- `@vertesia/ui/features`

If a suitable component exists, use it. Do not reimplement it with raw HTML just because the local version is faster to type.

This is especially strict for:

- tables
- page headers
- filters
- modals
- tabs
- badges
- buttons
- selects
- text inputs
- side panels
- empty/loading/error states

If you still introduce a custom wrapper, state which existing `@vertesia/ui` component you checked and why it was insufficient.

## Import Paths

```tsx
import { Button, Card, Input, VModal, VTabs } from '@vertesia/ui/core';
import { useFetch, useToast, useIntersectionObserver } from '@vertesia/ui/core';
import { FilterProvider, FilterBtn, FilterBar, FilterClear } from '@vertesia/ui/core';
import { useNavigate, useParams, NavLink, NestedRouterProvider } from '@vertesia/ui/router';
import { useUserSession } from '@vertesia/ui/session';
import { Sidebar, SidebarSection, SidebarItem, useSidebarToggle, FullHeightLayout } from '@vertesia/ui/layout';
import { GenericPageNavHeader, ModernAgentConversation } from '@vertesia/ui/features';
import { VertesiaShell, StandaloneApp } from '@vertesia/ui/shell';
```

## Key Component APIs

### Input — Value-based onChange (NOT event-based)

```tsx
// CORRECT — passes value directly
<Input value={name} onChange={setName} />
<Input value={name} onChange={(value) => setName(value.trim())} />

// WRONG — this will NOT work
<Input onChange={(e) => setName(e.target.value)} />  // ❌
```

**Textarea** uses standard React events: `onChange={(e) => setText(e.target.value)}`

### Button

```tsx
<Button onClick={handleClick}>Click Me</Button>
<Button variant="outline" size="sm">Secondary</Button>
<Button variant="destructive">Delete</Button>
// Variants: primary (default), destructive, outline, secondary, ghost, link, unstyled
// Sizes: xs, sm, md (default), lg, xl, icon
```

**Tooltip + accessible name are built in:** pass `alt="..."` (or `title="..."`) and `Button` auto-wraps with `VTooltip`. Don't wrap a `Button` in manual `VTooltip` (nested-button DOM) or add a separate `aria-label`. Manual `VTooltip` is only for non-Button triggers (span, icon, Badge) or non-default placement/size.

Use `isDisabled={...}` (documented prop). `size="icon"` is `rounded-full` — for a *square* icon button use `size="sm"`/`"xs"`. Example: `<Button variant="ghost" size="sm" alt="Refresh" onClick={refetch}><RefreshCw /></Button>`.

### VModal

```tsx
<VModal isOpen={open} onClose={() => setOpen(false)} size="md">
  <VModalTitle description="Optional subtitle">Title</VModalTitle>
  <VModalBody>Content</VModalBody>
  <VModalFooter>
    <Button onClick={handleSubmit}>Submit</Button>         {/* Primary first */}
    <Button variant="outline" onClick={onClose}>Cancel</Button>
  </VModalFooter>
</VModal>
```

**Note:** VModalFooter uses `flex-row-reverse` — primary button first in code, appears on the right.

### VTabs

```tsx
<VTabs defaultValue="tab1" tabs={[
  { name: 'tab1', label: 'First', content: <Tab1 /> },
  { name: 'tab2', label: 'Second', content: <Tab2 /> },
]}>
  <VTabsBar />
  <VTabsPanel />
</VTabs>
```

### Table

```tsx
import { Table, TBody, THead, Th, Tr, Td } from '@vertesia/ui/core';

<Table className="w-full">
  <THead>
    <tr>
      <th className="text-left">Name</th>
      <th className="text-left">Status</th>
    </tr>
  </THead>
  <TBody isLoading={isFirstLoading} columns={2}>
    {items.map(item => (
      <tr key={item.id}>
        <td>{item.name}</td>
        <td>{item.status}</td>
      </tr>
    ))}
  </TBody>
</Table>
```

`TBody` renders loading skeletons when `isLoading=true`. **Only use `isLoading` for initial empty-state load**, not for "load more" — show a separate `<Spinner />` below the table for appending.

Use this instead of custom `<table>` wrappers unless there is a documented gap.

### Infinite Scroll (Lazy Loading)

```tsx
import { useIntersectionObserver } from '@vertesia/ui/core';

const loadMoreRef = useRef<HTMLDivElement>(null);
const fetchGenRef = useRef(0);
const [isReady, setIsReady] = useState(false);

// Fetch with stale-request prevention
const fetchItems = useCallback((currentOffset: number, append: boolean) => {
    const gen = ++fetchGenRef.current;
    setIsLoading(true);
    client.someApi.list({ limit: PAGE_SIZE, offset: currentOffset })
        .then(data => {
            if (gen !== fetchGenRef.current) return; // stale
            setItems(prev => append ? [...prev, ...data.items] : data.items);
            setHasMore(data.hasNext);
            setOffset(currentOffset + data.items.length);
            setIsReady(true);
        })
        .finally(() => { if (gen === fetchGenRef.current) setIsLoading(false); });
}, [deps]);

// Trigger load when sentinel is visible
useIntersectionObserver(loadMoreRef, () => {
    if (isReady && hasMore && !isLoading) {
        setIsReady(false);
        fetchItems(offset, true);
    }
}, { threshold: 0.1, deps: [isReady, hasMore, isLoading, offset] });

// Reset helper — reuse for initial load, filter changes, refresh
const resetAndFetch = useCallback(() => {
    setItems([]); setOffset(0); setHasMore(true); setIsReady(false);
    fetchItems(0, false);
}, [fetchItems]);
```

```tsx
{/* After the table */}
{isLoading && items.length > 0 && <div className="flex justify-center py-4"><Spinner /></div>}
<div ref={loadMoreRef} className="h-4 w-full" />
{!isLoading && items.length === 0 && <div className="text-center text-sm text-muted py-8">No items found</div>}
```

**Always** use a generation counter (`fetchGenRef`) to prevent stale responses from race conditions.

### Filter System

```tsx
import { FilterProvider, FilterBtn, FilterBar, FilterClear } from '@vertesia/ui/core';

const filterGroups: FilterGroup[] = [
    { name: 'status', placeholder: 'Status', type: 'select', multiple: true,
      options: [
          { value: 'active', label: 'Active' },
          { value: 'archived', label: 'Archived' },
      ] },
    { name: 'search', placeholder: 'Search', type: 'text', multiple: false },
];

<FilterProvider filterGroups={filterGroups} filters={filters} setFilters={handleFilterChange}>
    <div className="flex gap-2 items-center">
        <FilterBtn />
        <FilterBar />
        <FilterClear />
    </div>
</FilterProvider>
```

Sort select options alphabetically by label. `FilterProvider` handles URL persistence automatically.

### Spinner, ErrorBox, Badge

```tsx
import { Spinner, ErrorBox, Badge } from '@vertesia/ui/core';

if (isLoading) return <Spinner />;
if (error) return <ErrorBox>{error.message}</ErrorBox>;
<Badge variant="secondary">Status</Badge>
```

## Routing

Use `NestedRouterProvider` for plugin routing (nested within host app):

```tsx
const routes = [
  { path: '/', Component: HomePage },
  { path: '/items/:id', Component: ItemPage },
  { path: '*', Component: NotFound },
];
<NestedRouterProvider routes={routes} index="/" />
```

### Navigation hooks

```tsx
const navigate = useNavigate();
navigate('/items/123');    // Push
navigate(-1);              // Go back

const { id } = useParams();           // From /items/:id
const [searchParams] = useSearchParams();
const path = useLocation().pathname;   // Current path
```

### NavLink

```tsx
<NavLink href="/items">Go to Items</NavLink>
```

### List / Detail Preservation

If a list page links to a detail page and users are expected to go back, do not keep the list state inside the list page component.

Preserve these concerns above the route boundary when they matter:

- active filters
- search query
- sort
- pagination or loaded results
- row selection
- scroll position

Use a provider above `NestedRouterProvider` or above the list/detail route split. Do not use a module-level singleton.

If `FilterProvider` is involved, remember that it restores filters from the URL on mount. If your list state also survives route changes, normalize or dedupe filter writes at the provider boundary so the same filter does not get appended repeatedly on back-navigation.

For scroll restoration:

- persist the list scroll position in provider state and `window.history.state.data`
- restore it in `useLayoutEffect`
- wait until the list has rendered before restoring, typically with `requestAnimationFrame`

Do not treat list/detail navigation as a cosmetic issue. If filters and scroll reset on back, the UX is wrong.

### Search vs Find For Table Surfaces

For table/list surfaces that need any combination of:

- full-text search
- backend sort
- backend facets

use one backend `search` path consistently.

Do not mix `find` for the default state with `search` for filtered states if the page exposes sort and facet-driven filtering. That creates different backend behavior depending on UI state and weakens the table contract.

Use `find` only for simple exact-match fetches that do not require backend sort, full-text behavior, or facets.

## Completion Check

Before calling a UI task complete, run a short conformance pass:

1. any raw `<table>` where `Table` / `THead` / `TBody` should be used?
2. any native `<select>` where `SelectBox` should be used?
3. any local page-header wrapper where `GenericPageNavHeader` would fit?
4. any inline styles that should move to CSS or semantic utility classes?
5. any custom wrapper that duplicates existing `@vertesia/ui` behavior without a documented gap?
6. any list/detail flow where filters, sort, or scroll reset on back-navigation because the state lives below the route boundary?
7. any `FilterProvider` usage that can double-restore URL filters into already-persisted React state?
8. any hover-reveal Tailwind classes built from template strings instead of literal class names?

If the answer is yes to any of the above, the UI pass is not done yet.

## Layout

### Sidebar

```tsx
<SidebarSection title="Navigation">
  <SidebarItem href="/app/settings" icon={SettingsIcon} current={path === '/app/settings'}>
    Settings
  </SidebarItem>
</SidebarSection>

// Footer section (pushed to bottom)
<SidebarSection isFooter>
  <ModeToggle label={isOpen ? 'Theme' : false} />
</SidebarSection>

// Truncate long labels
<SidebarItem href={href} icon={Icon} className="overflow-hidden">
  <span className="truncate">{longLabel}</span>
</SidebarItem>

const { isOpen, toggleMobile } = useSidebarToggle();
```

### GenericPageNavHeader

```tsx
<GenericPageNavHeader
  useDynamicBreadcrumbs={false}
  breadcrumbs={[
    <NavLink href="/" key="home">Home</NavLink>,
    <span key="current"><span>Current Page</span></span>,
  ]}
  actions={<Button>Create New</Button>}
/>
```

Prefer `GenericPageNavHeader` over a local page-header abstraction when it fits the page.

#### Breadcrumb rules

These bite repeatedly — apply them on every page that uses `GenericPageNavHeader`.

1. **Always pass `useDynamicBreadcrumbs={false}`.** The default (`true`) reads `window.history.state?.historyChain` and falls back to URL path inference. Both produce surprises: stale entries from a previous detail visit (e.g. "App > App") leak onto a top-level list, and URL inference capitalizes raw segments (e.g. "Objects" instead of your i18n label "Content Objects"). Explicit beats inferred.

2. **Don't combine `title=` with breadcrumbs for list/detail flows.** `title=` renders a big bold heading *under* the breadcrumb row, which on a detail page reads as a stacked title — not a breadcrumb. The real breadcrumb pattern is to put **all** segments in `breadcrumbs={[...]}` (parent → current) and omit `title=` entirely. composable-ui's `ContentObjectView` follows this.

3. **Wrap string labels in a nested element to avoid 20-char truncation.** `Breadcrumbs.renderBreadcrumbItem` slices any *string* label to 17 chars + `…`. Filenames and document titles hit this constantly. Pass a `ReactNode` instead and add CSS truncation:

   ```tsx
   <span key="current" title={fullName}>
     <span className="inline-block align-middle max-w-[60ch] truncate">
       {fullName}
     </span>
   </span>
   ```

   The outer `span`'s `children` is now a node, not a string, so the JS truncation path is skipped. The inner `span` truncates only when actually too wide for the layout. The `title=` gives a hover tooltip with the full name.

4. **`NavLink` works as a clickable breadcrumb item.** `GenericPageNavHeader` extracts `href` from the element and wires its own `onClick` to `navigate(href)`. No need to add `onClick` yourself.

5. **No back button.** The breadcrumb itself is the way back. Don't add a separate `<Button><ArrowLeft />Back</Button>` — it duplicates the breadcrumb's affordance and clutters the header.

#### Description prop

The `description` prop renders an `Info` tooltip icon in the breadcrumb row. When there are **no** breadcrumbs the icon orphans above the title — looks broken. Either omit `description=`, or always pair it with at least one breadcrumb.

## Data Fetching

### useFetch

```tsx
const { data, isLoading, error, refetch } = useFetch(
  async () => client.store.collections.list(),
  [dependency1, dependency2]
);
```

### useToast

```tsx
const toast = useToast();
toast({ title: 'Success', description: 'Item created' });
toast({ title: 'Error', description: err.message, variant: 'destructive' });
```

## Agent Conversation

Use `ModernAgentConversation` from `@vertesia/ui/features` for agent chat interfaces.

**Props:**
- `run` — `{ runId, workflowId } | undefined` — active conversation (undefined = start view)
- `startWorkflow` — `(initialMessage?) => Promise<{ run_id, workflow_id } | undefined>`
- `resetWorkflow` — `() => void` — new conversation callback
- `title`, `placeholder`, `startButtonText` — UI text
- `hideObjectLinking` — hide document linking UI
- `interactive` — enable user input during conversation
- `fullWidth` — disable max-width constraint

**URL persistence pattern:**
- Route: `/chat/:runId/:workflowId`
- Derive `run` from `useParams()` instead of React state
- After `startWorkflow`, `navigate('/chat/${result.runId}/${result.workflowId}')`
- `resetWorkflow` calls `navigate('/chat')`

**Listing past conversations (sidebar):**
- `client.store.workflows.listConversations({ interaction, page_size })` — returns `{ runs: WorkflowRun[] }`
- Each run has `run_id`, `workflow_id`, `started_at`, `status`, `topic`
- `listConversations` does NOT return `input` — only `topic` is available for labels
- Use `getRunDetails(runId, workflowId)` for full data including `input`

## Styling

### Semantic color classes

```tsx
<span className="text-success">Success</span>
<span className="text-attention">Warning</span>
<span className="text-destructive">Error</span>
<span className="text-muted-foreground">Muted</span>
<div className="bg-success/10 text-success">Success message</div>
```

### Layout patterns

- Use `flex flex-col gap-{n}` or `flex flex-row gap-{n}` for spacing (not `space-y-*`)
- Use `p-4 space-y-4` for padding + vertical spacing within forms
- Never hardcode colors — always use theme variables

### CSS customization

Override CSS custom properties in `index.css` after the shared import:

```css
@layer base {
  :root { --primary: oklch(55% 0.2 145); }
  .dark { --primary: oklch(75% 0.18 145); }
}
```

Available tokens: `--primary`, `--success`, `--attention`, `--destructive`, `--done`, `--info`, `--muted` (each with `-background` variant), `--background`, `--foreground`, `--card-*`, `--sidebar-*`, `--border`, `--input`, `--ring`.

### Tailwind Variant Safety

Do not build Tailwind variant classes dynamically in template strings when you need them emitted into CSS.

Bad:

```tsx
className={`opacity-0 group-hover/${groupName}:opacity-100`}
```

That class is usually invisible to Tailwind’s static analysis and will not be generated.

Use literal class names or a static map instead:

```tsx
const hoverClass = {
  contract: "group-hover/contract:opacity-100",
  owner: "group-hover/owner:opacity-100",
}[groupName];
```

This matters especially for hover-reveal filter buttons and row actions.

## Plugin Entry Points

### plugin.tsx (library mode)

Default export receives `{ slot: string }`. Render app when `slot === "page"`.

### main.tsx (standalone dev)

Wraps app in `VertesiaShell` + `RouterProvider`. Mounts `AdminApp` at `/`, plugin at `/app/`. Requires `VITE_APP_NAME` in `.env.local`. Access at https://localhost:5173 (HTTPS for Firebase auth).

## Security

Apply these rules to any page or component that takes user input or hits the API. Full patterns + code in `references/security.md`.

- Never pass unsanitized HTML to `dangerouslySetInnerHTML`.
- Validate user-provided URLs before rendering as links.
- Catch API errors, log details to console, surface a generic message via `useToast` — never leak internal error text.
- Client-side env vars must use the `VITE_` prefix (they are embedded in the bundle); keep secrets server-side.
- Throttle async button actions with an `isSubmitting` flag cleared in `finally`.

## Development Practices

- Extract components from map callbacks when the body has logic or is more than 2-3 lines
- Use `<Separator />` from `@vertesia/ui/core` for dividers instead of `border-t/b`
- Debounce expensive search operations
- Always throttle async button actions with `isSubmitting` (see `references/security.md`)
- Show generic user-facing error messages; log details to console
