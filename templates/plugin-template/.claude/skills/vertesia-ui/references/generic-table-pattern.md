# Generic Table Pattern

Use this pattern for list/detail repository pages built with `@vertesia/ui`.

It covers:

- backend-owned rows, sort, and facets
- `FilterProvider` with URL persistence
- inline row filters
- row click to open detail
- preserved filters and scroll on back-navigation

## Architecture

Keep list state above the route boundary.

Do not store these only in the list page if users need to go to detail and back without losing context:

- search query
- filters
- sort field and direction
- loaded results
- pagination or offset
- selection
- scroll position

Recommended shape:

```text
App
  ListStateProvider
    NestedRouterProvider
      /items
      /items/:id
```

## Backend Query Rule

If the table supports any of the following:

- full-text search
- server-side sort
- facet-backed filters

use one backend `search` path consistently.

Do not mix:

- `find` for the default state
- `search` for filtered or sorted states

That creates inconsistent behavior and makes the table harder to reason about.

## Provider Pattern

```tsx
import { createContext, useContext, useMemo, useState } from "react";
import type { Filter } from "@vertesia/ui/core";
import type { SortOption } from "@vertesia/common";

type SortField = "title" | "status" | "updated";

interface ListStateValue {
  query: string;
  setQuery: React.Dispatch<React.SetStateAction<string>>;
  filters: Filter[];
  setFilters: React.Dispatch<React.SetStateAction<Filter[]>>;
  sortField: SortField;
  setSortField: React.Dispatch<React.SetStateAction<SortField>>;
  sortDir: "asc" | "desc";
  setSortDir: React.Dispatch<React.SetStateAction<"asc" | "desc">>;
  scrollTop: number;
  setScrollTop: React.Dispatch<React.SetStateAction<number>>;
  data: SearchResult | undefined;
  isLoading: boolean;
  error: Error | undefined;
  refetch: () => Promise<unknown>;
}

const ListStateContext = createContext<ListStateValue | undefined>(undefined);

export function ListStateProvider({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = useState("");
  const [filters, setFiltersState] = useState<Filter[]>([]);
  const [sortField, setSortField] = useState<SortField>("updated");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [scrollTop, setScrollTop] = useState(0);

  const searchSort = useMemo<SortOption[]>(() => [
    { field: mapSortField(sortField), order: sortDir },
  ], [sortField, sortDir]);

  const result = useItemsSearch({
    query,
    filters,
    sort: searchSort,
  });

  const setFilters: React.Dispatch<React.SetStateAction<Filter[]>> = (value) => {
    setFiltersState((current) => {
      const next = typeof value === "function" ? value(current) : value;
      return dedupeFilters(next);
    });
  };

  const value = useMemo(() => ({
    query,
    setQuery,
    filters,
    setFilters,
    sortField,
    setSortField,
    sortDir,
    setSortDir,
    scrollTop,
    setScrollTop,
    data: result.data,
    isLoading: result.isLoading,
    error: result.error,
    refetch: result.refetch,
  }), [
    query,
    filters,
    setFilters,
    sortField,
    sortDir,
    scrollTop,
    result.data,
    result.isLoading,
    result.error,
    result.refetch,
  ]);

  return <ListStateContext.Provider value={value}>{children}</ListStateContext.Provider>;
}

export function useListState() {
  const value = useContext(ListStateContext);
  if (!value) throw new Error("useListState must be used inside ListStateProvider");
  return value;
}
```

## Search Hook Pattern

Return rows and facets from the same search call.

```tsx
interface SearchResult {
  items: ItemRecord[];
  facets: ComputedFacetResponse;
}

function useItemsSearch({
  query,
  filters,
  sort,
}: {
  query: string;
  filters: Filter[];
  sort: SortOption[];
}) {
  const { store } = useUserSession();

  return useFetch(async () => {
    const match: Record<string, unknown> = {};
    const status = getSelectFilterValue(filters, "status");
    const owner = getSelectFilterValue(filters, "owner");

    if (status !== "all") match["properties.status"] = status;
    if (owner !== "all") match["properties.owner"] = owner;

    const result = await store.objects.search({
      query: {
        ...(query.trim() ? { full_text: query.trim() } : {}),
        match: {
          "type.name": "my_type",
          ...match,
        },
      },
      limit: 100,
      sort,
      facets: [
        { name: "status", field: "properties.status" },
        { name: "owner", field: "properties.owner" },
      ],
    });

    return {
      items: result.results.map(toItemRecord),
      facets: result.facets,
    } satisfies SearchResult;
  }, [store, query, filters, sort]);
}
```

## Page Pattern

Use the provider state instead of local state.

```tsx
export function ItemsPage() {
  const navigate = useNavigate();
  const {
    query,
    setQuery,
    filters,
    setFilters,
    sortField,
    setSortField,
    sortDir,
    setSortDir,
    scrollTop,
    setScrollTop,
    data,
    isLoading,
  } = useListState();

  const restoreDoneRef = useRef(false);
  const items = data?.items || [];
  const facets = data?.facets;

  const filterGroups = useMemo(() => [
    { name: "status", placeholder: "Status", type: "select", options: facetOptions(facets?.status) },
    { name: "owner", placeholder: "Owner", type: "select", options: facetOptions(facets?.owner) },
  ], [facets]);

  useEffect(() => {
    const onScroll = () => {
      const next = window.scrollY;
      setScrollTop(next);
      persistScrollTop(next);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      const next = window.scrollY;
      setScrollTop(next);
      persistScrollTop(next);
      window.removeEventListener("scroll", onScroll);
    };
  }, [setScrollTop]);

  useLayoutEffect(() => {
    if (restoreDoneRef.current || isLoading) return;
    restoreDoneRef.current = true;
    const saved = readScrollTop() ?? scrollTop;
    const frame = requestAnimationFrame(() => {
      window.scrollTo({ top: saved, behavior: "auto" });
    });
    return () => cancelAnimationFrame(frame);
  }, [isLoading, scrollTop]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((current) => current === "asc" ? "desc" : "asc");
      return;
    }
    setSortField(field);
    setSortDir("asc");
  };

  return (
    <>
      <FilterProvider filters={filters} setFilters={setFilters} filterGroups={filterGroups}>
        <div className="flex items-center gap-2">
          <Input value={query} onChange={setQuery} />
          <FilterBtn />
          <FilterClear />
        </div>
        <FilterBar />
      </FilterProvider>

      <ItemsTable
        items={items}
        isLoading={isLoading}
        sortField={sortField}
        sortDir={sortDir}
        onSort={handleSort}
        onOpen={(id) => navigate(`/items/${id}`)}
      />
    </>
  );
}
```

## Table Pattern

Use `Table`, `THead`, and `TBody` directly.

```tsx
<Table className="w-full min-w-[960px]">
  <THead>
    <tr>
      <SortableHead field="title" label="Title" />
      <SortableHead field="status" label="Status" />
      <SortableHead field="updated" label="Updated" />
    </tr>
  </THead>
  <TBody isLoading={isLoading} columns={3} rows={6}>
    {items.map((item) => (
      <tr
        key={item.id}
        className="cursor-pointer"
        onClick={() => onOpen(item.id)}
      >
        <td className="group/title">
          <div className="flex items-center justify-between gap-2">
            <span>{item.title}</span>
            <InlineFilterButton
              tooltip={`Filter by ${item.title}`}
              hoverClass="group-hover/title:opacity-100"
              onClick={() => onFilterValue("title", item.title)}
            />
          </div>
        </td>
      </tr>
    ))}
  </TBody>
</Table>
```

## Inline Filter Button Pattern

Do not assemble Tailwind hover classes dynamically.

Bad:

```tsx
className={`opacity-0 group-hover/${groupName}:opacity-100`}
```

Good:

```tsx
const hoverClass = {
  title: "group-hover/title:opacity-100",
  owner: "group-hover/owner:opacity-100",
}[groupName];
```

```tsx
function InlineFilterButton({
  tooltip,
  hoverClass,
  onClick,
}: {
  tooltip: string;
  hoverClass: string;
  onClick: () => void;
}) {
  return (
    <VTooltip description={tooltip} asChild>
      <Button
        variant="ghost"
        size="sm"
        aria-label={tooltip}
        className={`h-6 w-6 p-0 opacity-0 transition-opacity focus-visible:opacity-100 ${hoverClass}`}
        onClick={(event) => {
          event.stopPropagation();
          onClick();
        }}
      >
        <Filter className="size-4" />
      </Button>
    </VTooltip>
  );
}
```

## Filter Deduplication Rule

If both of these are true:

- the list state survives route changes
- `FilterProvider` restores filters from the URL on mount

then filter writes must be normalized or deduped.

Otherwise, going to detail and back can duplicate chips and query params.

```tsx
function dedupeFilters(filters: Filter[]) {
  const seen = new Set<string>();
  const deduped: Filter[] = [];

  for (const filter of filters) {
    const normalizedValue = Array.isArray(filter.value)
      ? filter.value.map((entry) => typeof entry === "string" ? entry : `${entry.value}|${entry.label || ""}`)
      : [];
    const key = [
      filter.name,
      filter.type,
      filter.multiple ? "multi" : "single",
      ...normalizedValue,
    ].join("::");

    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(filter);
  }

  return deduped;
}
```

## Scroll Persistence Pattern

The naïve "save on scroll, restore on mount" approach has several traps that bit us in production. Apply the rules below — the helpers are simple, the gotchas are not.

### Persist + read helpers

```tsx
function persistScrollTop(scrollTop: number) {
  const state = window.history.state || {};
  window.history.replaceState({
    ...state,
    data: {
      ...(state.data || {}),
      listScrollTop: scrollTop,
    },
  }, "");
}

function readScrollTop() {
  const state = window.history.state as { data?: { listScrollTop?: number } } | null;
  return state?.data?.listScrollTop;
}
```

### Find the actual scrolling element at runtime

In nested layouts (e.g. an `AppLayout` with its own `overflow-y-auto` wrapper), the element that actually scrolls is **not always** the inner `ref` you attach to. The inner div may have `overflow-auto` but no overflow yet (during initial render with empty items), so the user ends up scrolling an ancestor. Walk up from the ref:

```tsx
function findScrollableElement(start: HTMLElement | null): HTMLElement | null {
  let current: HTMLElement | null = start;
  while (current && current !== document.body) {
    const overflowY = window.getComputedStyle(current).overflowY;
    const canScroll =
      (overflowY === 'auto' || overflowY === 'scroll') &&
      current.scrollHeight > current.clientHeight;
    if (canScroll) return current;
    current = current.parentElement;
  }
  return document.scrollingElement as HTMLElement | null;
}
```

Use the result for both attaching the listener AND for restoration.

### Listener: persist on every event, **never on cleanup**

```tsx
useEffect(() => {
  const el = findScrollableElement(scrollContainerRef.current);
  scrollElRef.current = el;
  if (!el) return;
  const onScroll = () => {
    const next = el.scrollTop;
    setScrollTop(next);          // provider state (in-memory, survives reload)
    persistScrollTop(next);      // history.state (survives full reload)
  };
  el.addEventListener('scroll', onScroll, { passive: true });
  return () => {
    el.removeEventListener('scroll', onScroll);
    // ⚠️ Do NOT read el.scrollTop here and "flush" it. By the time cleanup
    // runs, the route has changed and the DOM is being detached — el.scrollTop
    // reads as 0 and would clobber the value the on-scroll listener already
    // saved. The listener has already persisted the latest value on every
    // scroll; cleanup just removes the listener.
  };
}, [setScrollTop]);
```

### Restore: synchronous in `useLayoutEffect`, fall back to rAF only if needed

A naïve `requestAnimationFrame(() => el.scrollTop = target)` produces a one-frame flash to the top before the rAF fires. Restore synchronously inside `useLayoutEffect` (which runs before paint); only poll rAF if the DOM hasn't laid out enough rows yet for the scroll target to be reachable.

```tsx
useLayoutEffect(() => {
  if (restoreDoneRef.current) return;
  if (isLoading || items.length === 0) return;
  const target = readScrollTop() ?? scrollTop;
  if (target <= 0) {
    restoreDoneRef.current = true;
    return;
  }

  const trySync = (): boolean => {
    const el = scrollElRef.current ?? findScrollableElement(scrollContainerRef.current);
    scrollElRef.current = el;
    if (!el) return false;
    const maxScroll = el.scrollHeight - el.clientHeight;
    if (maxScroll < target) return false;
    el.scrollTop = target;
    return true;
  };

  if (trySync()) {
    restoreDoneRef.current = true;
    return;
  }

  // Poll rAF until rows render enough scrollHeight for the target.
  let attempts = 0, cancelled = false;
  const tryAsync = () => {
    if (cancelled) return;
    if (trySync() || attempts >= 10) {
      const el = scrollElRef.current;
      if (el && !restoreDoneRef.current) {
        const maxScroll = el.scrollHeight - el.clientHeight;
        el.scrollTop = Math.min(target, Math.max(maxScroll, 0));
      }
      restoreDoneRef.current = true;
      return;
    }
    attempts++;
    requestAnimationFrame(tryAsync);
  };
  const frame = requestAnimationFrame(tryAsync);
  return () => { cancelled = true; cancelAnimationFrame(frame); };
}, [isLoading, items.length, scrollTop]);
```

### Provider state is the source of truth, history.state is a nice-to-have

Push-based routers (including `NestedRouterProvider`) create a **new history entry** when you `navigate('/list')` from a detail page, so the original entry's saved `data.listScrollTop` is "behind" you and `readScrollTop()` returns `undefined`. The restore must fall back to provider state (`scrollTop`), which survives across route changes because the provider lives above the route boundary. The history.state path only helps for full-page reloads.

### Common failure modes (what bit us)

| Symptom | Cause | Fix |
| --- | --- | --- |
| Scroll resets to top on first back-nav, works on second | Cleanup persisted `el.scrollTop = 0` (DOM detached at cleanup time), clobbering the saved value | Don't persist on cleanup |
| Listener attaches to `<html>` and never fires | `findScrollableElement` ran when items were empty; inner div had no overflow yet, so it walked all the way up | Walk-up logic + provider state covers it |
| Visible flash to top before scroll lands | Restore wrapped in `requestAnimationFrame` with no synchronous attempt | Try synchronously inside `useLayoutEffect` first |
| StrictMode double-mount loses scroll | Cleanup persists 0 between passes; second mount reads 0 | Don't persist on cleanup |
| `fromHistory = undefined` after back-nav | Router pushes new entry instead of going back via browser history | Provider state is the primary source |

## Checklist

Before calling a list/detail table done:

1. does the table use `Table`, `THead`, `TBody` directly?
2. does backend search own rows, sort, and facets?
3. is list state above the route boundary?
4. are URL-restored filters deduped or normalized?
5. is scroll restored on back-navigation?
6. are hover-reveal classes literal/static so Tailwind emits them?
