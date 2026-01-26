/**
 * @vertesia/fusion-ux
 *
 * Dynamic model-generated UI components for Vertesia.
 *
 * This package provides components that render model-generated templates
 * with actual data. The model generates structure (template), the system
 * provides values (data).
 *
 * @example
 * ```tsx
 * import {
 *   FusionFragmentRenderer,
 *   FusionFragmentProvider,
 *   FusionFragmentHandler,
 * } from '@vertesia/fusion-ux';
 *
 * // Option 1: Direct rendering with template and data
 * <FusionFragmentRenderer
 *   template={templateFromModel}
 *   data={actualData}
 *   onUpdate={handleUpdate}
 * />
 *
 * // Option 2: Context-based rendering (for markdown code blocks)
 * <FusionFragmentProvider data={fund.parameters} onUpdate={handleUpdate}>
 *   <MarkdownRenderer content={agentResponse} />
 * </FusionFragmentProvider>
 *
 * // Option 3: Code block handler for markdown renderers
 * const codeBlockRenderers = {
 *   'fusion-fragment': ({ code }) => <FusionFragmentHandler code={code} />
 * };
 * ```
 *
 * @packageDocumentation
 */

// Types
export type {
  FragmentTemplate,
  SectionTemplate,
  FieldTemplate,
  ColumnTemplate,
  ChartTemplate,
  VegaLiteSpec,
  ValidationResult,
  ValidationError,
  FusionFragmentRendererProps,
  SectionRendererProps,
  FieldRendererProps,
  FusionFragmentContextValue,
  ValidateFusionFragmentInput,
} from './types.js';

// Components
export {
  FusionFragmentRenderer,
  SectionRenderer,
  FieldRenderer,
  FusionFragmentProvider,
  FusionFragmentHandler,
  useFusionFragmentContext,
  useFusionFragmentContextSafe,
  createFusionFragmentCodeBlockRenderer,
  type FusionFragmentProviderProps,
  type FusionFragmentHandlerProps,
} from './fusion-fragment/index.js';

// Validation utilities
export {
  validateTemplate,
  parseAndValidateTemplate,
  FragmentTemplateSchema,
  SectionTemplateSchema,
  FieldTemplateSchema,
  findClosestKey,
  findSimilarKeys,
  formatValidationErrors,
  formatValidationSuccess,
  formatAvailableKeys,
} from './validation/index.js';

// Render utilities (text preview only - image rendering is in apps/tools)
export {
  generateTextPreview,
  generateSampleData,
  generateCompactPreview,
} from './render/index.js';

// Data binding resolver
export {
  // Types
  type ResolvedBinding,
  type ResolutionContext,
  type PageDataResult,
  type ResolveOptions,
  type DataFetchers,
  type DataCache,
  type ResolverConfig,
  type DataBindingResolver,
  type PageDataState,
  type UsePageDataOptions,
  // Resolver
  createDataBindingResolver,
  builtInTransforms,
  // Interpolation utilities
  interpolateString,
  interpolateObject,
  getNestedValue,
  hasInterpolation,
  extractInterpolationKeys,
  validateInterpolationKeys,
  // React hooks
  DataBindingResolverContext,
  useDataBindingResolver,
  usePageData,
  useBinding,
  usePollingData,
} from './data-binding/index.js';

// Fusion Page rendering
export {
  // Types
  type FusionPageRendererProps,
  type PageLayoutRendererProps,
  type RegionRendererProps,
  type ContentRendererProps,
  type ActionButtonProps,
  type BreadcrumbsRendererProps,
  type PageHeaderProps,
  type ContentRendererRegistry,
  type FusionPageContextValue,
  type FusionPageProviderProps,
  // Context
  FusionPageContext,
  FusionPageProvider,
  useFusionPageContext,
  useFusionPageContextSafe,
  createContentRendererRegistry,
  // Renderers
  FusionPageRenderer,
  FusionPageWithData,
  PageLayoutRenderer,
  RegionRenderer,
  ContentRenderer,
  PageHeader,
  ActionButton,
  executeAction,
} from './fusion-page/index.js';

// Fusion Navigation
export {
  // Types
  type NavigationRendererProps,
  type SidebarNavigationProps,
  type TopbarNavigationProps,
  type NavigationSectionProps,
  type NavigationItemProps,
  type NavigationLinkProps,
  type NavigationGroupProps,
  type DynamicNavigationProps,
  type NavigationContextValue,
  type NavigationProviderProps,
  // Context
  NavigationContext,
  NavigationProvider,
  useNavigationContext,
  useNavigationContextSafe,
  // Renderers
  NavigationRenderer,
  SimpleSidebarNavigation,
  SidebarNavigation,
  NavigationSection,
  TopbarNavigation,
  NavigationItem,
  NavigationLink,
  NavigationGroup,
  DynamicNavigation,
} from './fusion-navigation/index.js';

// Fusion Application
export {
  // Types
  type MatchedRoute,
  type FusionApplicationRendererProps,
  type ApplicationShellProps,
  type ApplicationRouterProps,
  type ApplicationContextValue,
  type ThemeProviderProps,
  type RouteUtils,
  type ApplicationProviderProps,
  // Context
  ApplicationContext,
  ApplicationProvider,
  useApplicationContext,
  useApplicationContextSafe,
  useCurrentRoute,
  useCurrentPage,
  useGlobalData,
  useGlobalDataValue,
  useApplicationSettings,
  useNavigation,
  // Renderers
  FusionApplicationRenderer,
  StandalonePageRenderer,
  ApplicationShell,
  ThemeProvider,
  ApplicationRouter,
  // Routing utilities
  matchPath,
  matchRoute,
  buildPath,
  extractParamNames,
  validateParams,
  applyParamDefaults,
  checkRoutePermission,
  getUnauthorizedRedirect,
} from './fusion-application/index.js';

// Default styles (import for styling)
// Usage: import '@vertesia/fusion-ux/styles';

// Fusion Runtime
export {
  // Types
  type FetchFunction,
  type FusionRuntimeConfig,
  type AnalyticsEventType,
  type AnalyticsEvent,
  type FusionRuntimeState,
  type SSRResult,
  type SSRHeadElements,
  type SSRContext,
  type HydrationData,
  type FusionRuntimeContextValue,
  type PrefetchOptions,
  type PrefetchResult,
  type FusionRuntimeProviderProps,
  type ServerLoadOptions,
  type ServerLoadResult,
  // Runtime class
  FusionRuntime,
  createFusionRuntime,
  // Context and hooks
  FusionRuntimeContext,
  FusionRuntimeProvider,
  useFusionRuntime,
  useFusionRuntimeSafe,
  useRuntimeState,
  useRuntimeApplication,
  useRuntimeNavigation,
  useAnalytics,
  useRuntimeUser,
  // Server utilities
  loadServerData,
  generateHeadElements,
  createHydrationData,
  serializeHydrationData,
  generateHydrationScript,
  parseHydrationData,
  createServerFetchers,
} from './fusion-runtime/index.js';
