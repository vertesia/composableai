---
name: vertesia-ui
description: Reference for building UIs with @vertesia/ui. Covers component API (Input, Button, Card, Modal, Tabs, Table), table views with infinite scroll and filters, layout (Sidebar, FullHeightLayout), routing (NestedRouterProvider, useParams, useNavigate), agent conversation (ModernAgentConversation), and styling. Use when creating or modifying React UI pages or components.
---

# Vertesia UI Development

React UI built with React 19, Tailwind CSS 4, and `@vertesia/ui` components.

For the full component API reference, see also `composableai/packages/ui/llms.txt` (shipped with the npm package).

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
// Variants: default, destructive, outline, secondary, ghost, link
// Sizes: default, sm, lg, icon
```

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
  title="Page Title"
  description="Optional description"
  breadcrumbs={[
    <NavLink href="/" key="home">Home</NavLink>,
    <span key="current">Current Page</span>,
  ]}
  actions={<Button>Create New</Button>}
/>
```

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

## Plugin Entry Points

### plugin.tsx (library mode)

Default export receives `{ slot: string }`. Render app when `slot === "page"`.

### main.tsx (standalone dev)

Wraps app in `VertesiaShell` + `RouterProvider`. Mounts `AdminApp` at `/`, plugin at `/app/`. Requires `VITE_APP_NAME` in `.env.local`. Access at https://localhost:5173 (HTTPS for Firebase auth).

## Security

### XSS Prevention

React escapes JSX content automatically, but be careful with:

```tsx
// NEVER use dangerouslySetInnerHTML with unsanitized input
<div dangerouslySetInnerHTML={{ __html: userInput }} />  // ❌

// If you must render HTML, sanitize first
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userInput) }} />  // ✅
```

### URL Validation

Validate user-provided URLs before rendering as links:

```tsx
function isValidUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return ['http:', 'https:'].includes(parsed.protocol);
    } catch { return false; }
}

// Only render validated URLs
{isValidUrl(userUrl) && <a href={userUrl}>Link</a>}
```

### Error Handling

Never expose internal details in user-facing errors:

```tsx
try {
    await client.objects.retrieve(objectId);
} catch (error) {
    console.error('Object retrieval failed:', error);  // Log full details
    toast({ title: 'Error', description: 'Unable to load data. Please try again.', variant: 'destructive' });  // Generic message
}
```

### Secrets

- Never hardcode API keys or tokens — use environment variables
- Prefix client-side env vars with `VITE_` (they are embedded in the bundle)
- Keep sensitive keys server-side only (tool server code, not UI)
- Never commit `.env` files — use `.env.example` for documentation

### Form Security

- Validate inputs before submitting (use Zod or similar for schema validation)
- Validate file uploads: check type, size, and extension before uploading

```tsx
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

if (file.size > MAX_SIZE) throw new Error('File too large');
if (!ALLOWED_TYPES.includes(file.type)) throw new Error('Invalid file type');
```

### Client-Side Throttling

Disable buttons after the first click and re-enable in a `finally` block. This prevents duplicate submissions and gives users clear feedback:

```tsx
const [isSubmitting, setIsSubmitting] = useState(false);

async function handleSubmit() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
        await client.someApi.doAction(payload);
        toast({ title: 'Success', description: 'Item saved' });
    } catch (error) {
        console.error('Action failed:', error);
        toast({ title: 'Error', description: 'Unable to save. Please try again.', variant: 'destructive' });
    } finally {
        setIsSubmitting(false);
    }
}

<Button onClick={handleSubmit} disabled={isSubmitting}>
    {isSubmitting ? 'Saving...' : 'Save'}
</Button>
```

Apply this pattern to **every** button that triggers an async action — form submissions, delete confirmations, API calls, etc.

## Development Practices

- Extract components from map callbacks when the body has logic or is more than 2-3 lines
- Use `<Separator />` from `@vertesia/ui/core` for dividers instead of `border-t/b`
- Debounce expensive search operations
- Always use the client-side throttling pattern (see Security section) for async button actions
- Show generic user-facing error messages; log details to console
