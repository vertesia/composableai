import type { AppDashboardDefinition } from '@vertesia/common';

/**
 * Dashboards exposed by this plugin.
 *
 * Each dashboard renders as `app:<app_name>:<id>` in the host platform — read-only
 * until a user clones it into a stored dashboard. Use `dataSource: { type: "store_es_dsl", ... }`
 * to ship business dashboards over Store/ES data without per-project records.
 *
 * Add a definition object per dashboard, or import from sibling files.
 *
 * @see AppDashboardDefinition in @vertesia/common
 */
export const dashboards: AppDashboardDefinition[] = [];
