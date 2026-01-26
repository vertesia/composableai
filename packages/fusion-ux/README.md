# @vertesia/fusion-ux

Dynamic model-generated UI components for Vertesia. This package provides React components for rendering AI-generated business applications, pages, navigation, and data-bound templates.

## Overview

The Fusion UX package enables the creation of complete business applications from AI-generated specifications:

- **Fusion Fragments**: Dynamic UI templates for displaying structured data as formatted cards, tables, and charts
- **Fusion Pages**: Complete page layouts with regions, content types, data bindings, and actions
- **Fusion Navigation**: Sidebar, topbar, and footer navigation with dynamic data-driven items
- **Fusion Applications**: Full application runtime with routing, theming, and global data
- **Fusion Runtime**: Server-side rendering, hydration, and runtime state management
- **Data Binding**: Flexible data resolution from multiple sources

## Installation

```bash
pnpm add @vertesia/fusion-ux
```

## Quick Start

### Rendering a Fragment

```tsx
import { FusionFragmentRenderer } from '@vertesia/fusion-ux';

const template = {
  title: 'Customer Details',
  sections: [
    {
      title: 'Information',
      layout: 'grid-3',
      fields: [
        { label: 'Name', key: 'name' },
        { label: 'Email', key: 'email' },
        { label: 'Status', key: 'status', highlight: 'success' }
      ]
    }
  ]
};

<FusionFragmentRenderer
  template={template}
  data={{ name: 'John Doe', email: 'john@example.com', status: 'Active' }}
  onUpdate={(key, value) => console.log(`Updated ${key} to ${value}`)}
/>
```

### Rendering a Page

```tsx
import { FusionPageRenderer, createDataBindingResolver } from '@vertesia/fusion-ux';

const page = {
  id: 'customer-details',
  title: 'Customer Details',
  layout: { type: 'sidebar-left' },
  regions: [
    { id: 'sidebar', content: [{ type: 'fragment', key: 'customerNav' }] },
    { id: 'main', content: [{ type: 'fragment', key: 'customerDetails' }] }
  ],
  dataBindings: [
    { key: 'customer', source: 'contentObject', objectId: '{{route.id}}' }
  ]
};

const resolver = createDataBindingResolver({
  fetchers: {
    fetchContentObject: (id) => api.getObject(id),
    queryObjects: (query) => api.queryObjects(query),
    fetchDataStore: (key) => dataStore.get(key),
    fetchArtifact: (path) => artifacts.get(path),
  }
});

<FusionPageRenderer
  page={page}
  context={{ route: { id: 'cust_123' } }}
  resolver={resolver}
  onNavigate={(href) => router.push(href)}
  onAction={(action) => handleAction(action)}
/>
```

### Rendering an Application

```tsx
import { FusionApplicationRenderer } from '@vertesia/fusion-ux';

const application = {
  id: 'inventory-app',
  title: 'Inventory Manager',
  navigation: {
    sidebar: [
      {
        id: 'main',
        title: 'Menu',
        items: [
          { id: 'dashboard', type: 'link', label: 'Dashboard', icon: { type: 'lucide', value: 'home' }, href: '/dashboard' },
          { id: 'products', type: 'link', label: 'Products', href: '/products' }
        ]
      }
    ]
  },
  routes: [
    { path: '/dashboard', pageId: 'page_dashboard' },
    { path: '/products', pageId: 'page_products' },
    { path: '/products/:id', pageId: 'page_product_details' }
  ],
  defaultRoute: '/dashboard',
  theme: {
    primaryColor: '#3B82F6',
    borderRadius: 'md'
  }
};

<FusionApplicationRenderer
  application={application}
  currentPath={router.pathname}
  loadPage={(pageId) => api.fusion.pages.retrieve(pageId)}
  resolver={resolver}
  user={{ id: 'user_123', roles: ['admin'] }}
  onNavigate={(href) => router.push(href)}
/>
```

## Module Reference

### 1. Fusion Fragment

Renders dynamic UI templates for displaying structured data.

**Components:**
- `FusionFragmentRenderer` - Main fragment component
- `SectionRenderer` - Renders individual sections
- `FieldRenderer` - Renders individual fields
- `FusionFragmentProvider` - Context for markdown integration

**Layouts:** `grid-2`, `grid-3`, `grid-4`, `list`, `table`, `chart`

**Field Formats:** `text`, `number`, `currency`, `percent`, `date`, `boolean`

**Highlighting:** `success`, `warning`, `error`, `info`

### 2. Fusion Page

Renders complete page layouts with multiple content types.

**Components:**
- `FusionPageRenderer` - Main page component
- `PageLayoutRenderer` - Handles layout types
- `RegionRenderer` - Renders content regions
- `ContentRenderer` - Renders content types
- `PageHeader` - Header with breadcrumbs and actions
- `ActionButton` - Configurable action buttons

**Layout Types:**
| Type | Description | Regions |
|------|-------------|---------|
| `single` | Full-width column | main |
| `sidebar-left` | Left sidebar | sidebar, main |
| `sidebar-right` | Right sidebar | main, sidebar |
| `two-column` | Two equal columns | left, right |
| `three-column` | Three columns | left, center, right |
| `tabs` | Tabbed interface | Per tab |
| `accordion` | Collapsible sections | Per section |
| `dashboard` | Grid-based | Multiple |

**Content Types:** `fragment`, `table`, `chart`, `form`, `html`, `markdown`, `empty-state`, `component`

### 3. Fusion Navigation

Renders application navigation structures.

**Components:**
- `SidebarNavigation` - Main sidebar
- `TopbarNavigation` - Horizontal nav
- `NavigationSection` - Grouped items
- `NavigationItem` - Individual items
- `DynamicNavigation` - Data-driven items

**Item Types:** `link`, `group`, `action`, `divider`

### 4. Fusion Application

Complete application runtime.

**Components:**
- `FusionApplicationRenderer` - Main app component
- `ApplicationShell` - Layout with navigation
- `ApplicationRouter` - Route matching
- `ThemeProvider` - Theme customization
- `ApplicationContext` - App state

**Hooks:**
- `useApplicationContext` - Access app context
- `useCurrentRoute` - Get matched route
- `useCurrentPage` - Get current page
- `useGlobalData` - Access global data
- `useNavigation` - Navigation helpers

### 5. Fusion Runtime

Server-side rendering and runtime.

**Class:**
- `FusionRuntime` - Runtime initialization and state

**Hooks:**
- `useFusionRuntime` - Access runtime
- `useRuntimeState` - Get state
- `useRuntimeNavigation` - Navigate
- `useAnalytics` - Track events

**Server Utilities:**
- `loadServerData` - SSR data loading
- `generateHeadElements` - Meta tags
- `createHydrationData` - Hydration data
- `parseHydrationData` - Client hydration

### 6. Data Binding

Resolves data from various sources.

**Resolver:**
```tsx
const resolver = createDataBindingResolver({
  fetchers: {
    fetchContentObject: (id, options) => Promise<object>,
    queryObjects: (query) => Promise<{ items: object[] }>,
    fetchDataStore: (key) => Promise<unknown>,
    fetchArtifact: (path) => Promise<unknown>,
  },
  cache: optionalCache,
  defaultTimeout: 30000,
  transforms: { customTransform: (data, ctx) => transformedData }
});
```

**Data Sources:**
| Source | Description |
|--------|-------------|
| `contentObject` | Single object by ID |
| `objectQuery` | Query multiple objects |
| `dataStore` | Key-value store |
| `artifact` | Artifact storage |
| `api` | REST API endpoint |
| `static` | Static data |
| `route` | Route parameters |

**Hooks:**
- `usePageData(bindings, context)` - Load all bindings
- `useBinding(binding, context)` - Load single binding
- `usePollingData(binding, context, interval)` - Auto-refresh

## Validation

```tsx
import { validateTemplate, parseAndValidateTemplate } from '@vertesia/fusion-ux';

// Validate a template object
const result = validateTemplate(template, ['firmName', 'fundName', 'vintageYear']);
if (!result.valid) {
  console.log(result.errors);
  // Includes suggestions for typos
}

// Parse and validate JSON string
const result = parseAndValidateTemplate(jsonString, availableKeys);
```

## Server-Side Rendering

```tsx
import {
  loadServerData,
  createHydrationData,
  generateHydrationScript
} from '@vertesia/fusion-ux';

// In your server route handler
export async function handleRequest(req) {
  const result = await loadServerData({
    application,
    path: req.url,
    config: { dataFetchers: serverFetchers },
    user: req.user,
  });

  if (result.redirect) {
    return redirect(result.redirect);
  }

  const hydrationData = createHydrationData(
    application,
    result.page,
    result.data,
    req.url,
    req.user
  );

  return renderToString(
    <>
      <FusionApplicationRenderer
        application={application}
        currentPath={req.url}
        {...otherProps}
      />
      <script dangerouslySetInnerHTML={{
        __html: generateHydrationScript(hydrationData)
      }} />
    </>
  );
}
```

## Type Exports

```tsx
import type {
  // Fragment
  FragmentTemplate, SectionTemplate, FieldTemplate, ChartTemplate,
  FusionFragmentRendererProps, ValidationResult,

  // Page
  FusionPageRendererProps, PageLayoutRendererProps,
  RegionRendererProps, ContentRendererProps,
  FusionPageContextValue,

  // Navigation
  NavigationRendererProps, SidebarNavigationProps,
  NavigationItemProps, NavigationContextValue,

  // Application
  FusionApplicationRendererProps, ApplicationShellProps,
  ApplicationContextValue, MatchedRoute, RouteUtils,

  // Runtime
  FusionRuntimeConfig, FusionRuntimeState,
  SSRResult, SSRHeadElements, HydrationData,

  // Data Binding
  DataBindingResolver, ResolutionContext,
  PageDataResult, DataFetchers, ResolverConfig,
} from '@vertesia/fusion-ux';
```

## AI Tool Integration

The package integrates with AI tools through skills:

- **fusion-fragment**: Generate and validate UI templates
- **fusion-page**: Create and manage pages
- **fusion-application**: Create and manage applications

See the skills documentation in `apps/tools/src/skills/fusion-ux/`.

## License

Proprietary - Vertesia Inc.
