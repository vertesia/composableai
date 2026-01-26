/**
 * Page Layout Renderer
 *
 * Renders page content according to layout specifications.
 * Supports various layout types: single, sidebar, two-column, three-column, tabs, accordion.
 */

import React from 'react';
import type { PageRegionSpec } from '@vertesia/common';
import type { PageLayoutRendererProps } from './types.js';
import { RegionRenderer } from './RegionRenderer.js';

/**
 * Get regions for a specific slot.
 */
function getRegionsForSlot(regions: PageRegionSpec[], slot: string): PageRegionSpec[] {
    return regions.filter((r) => r.slot === slot);
}

/**
 * Render a single-column layout.
 */
function SingleColumnLayout({
    regions,
    data,
    context,
    onAction,
    onUpdate,
    onNavigate,
}: Omit<PageLayoutRendererProps, 'layout'>) {
    const mainRegions = getRegionsForSlot(regions, 'main');

    return (
        <div className="fusion-layout fusion-layout-single">
            <div className="fusion-layout-main">
                {mainRegions.map((region, index) => (
                    <RegionRenderer
                        key={region.id || `region-${index}`}
                        region={region}
                        data={data}
                        context={context}
                        onAction={onAction}
                        onUpdate={onUpdate}
                        onNavigate={onNavigate}
                    />
                ))}
            </div>
        </div>
    );
}

/**
 * Render a sidebar-left layout.
 */
function SidebarLeftLayout({
    layout,
    regions,
    data,
    context,
    onAction,
    onUpdate,
    onNavigate,
}: PageLayoutRendererProps) {
    const sidebarRegions = getRegionsForSlot(regions, 'sidebar');
    const mainRegions = getRegionsForSlot(regions, 'main');
    const sidebarWidth = layout.options?.sidebarWidth || '250px';

    return (
        <div
            className="fusion-layout fusion-layout-sidebar-left"
            style={{ '--sidebar-width': sidebarWidth } as React.CSSProperties}
        >
            <aside className="fusion-layout-sidebar">
                {sidebarRegions.map((region, index) => (
                    <RegionRenderer
                        key={region.id || `sidebar-${index}`}
                        region={region}
                        data={data}
                        context={context}
                        onAction={onAction}
                        onUpdate={onUpdate}
                        onNavigate={onNavigate}
                    />
                ))}
            </aside>
            <main className="fusion-layout-main">
                {mainRegions.map((region, index) => (
                    <RegionRenderer
                        key={region.id || `main-${index}`}
                        region={region}
                        data={data}
                        context={context}
                        onAction={onAction}
                        onUpdate={onUpdate}
                        onNavigate={onNavigate}
                    />
                ))}
            </main>
        </div>
    );
}

/**
 * Render a sidebar-right layout.
 */
function SidebarRightLayout({
    layout,
    regions,
    data,
    context,
    onAction,
    onUpdate,
    onNavigate,
}: PageLayoutRendererProps) {
    const mainRegions = getRegionsForSlot(regions, 'main');
    const sidebarRegions = getRegionsForSlot(regions, 'sidebar');
    const sidebarWidth = layout.options?.sidebarWidth || '250px';

    return (
        <div
            className="fusion-layout fusion-layout-sidebar-right"
            style={{ '--sidebar-width': sidebarWidth } as React.CSSProperties}
        >
            <main className="fusion-layout-main">
                {mainRegions.map((region, index) => (
                    <RegionRenderer
                        key={region.id || `main-${index}`}
                        region={region}
                        data={data}
                        context={context}
                        onAction={onAction}
                        onUpdate={onUpdate}
                        onNavigate={onNavigate}
                    />
                ))}
            </main>
            <aside className="fusion-layout-sidebar">
                {sidebarRegions.map((region, index) => (
                    <RegionRenderer
                        key={region.id || `sidebar-${index}`}
                        region={region}
                        data={data}
                        context={context}
                        onAction={onAction}
                        onUpdate={onUpdate}
                        onNavigate={onNavigate}
                    />
                ))}
            </aside>
        </div>
    );
}

/**
 * Render a two-column layout.
 */
function TwoColumnLayout({
    layout,
    regions,
    data,
    context,
    onAction,
    onUpdate,
    onNavigate,
}: PageLayoutRendererProps) {
    const leftRegions = getRegionsForSlot(regions, 'left');
    const rightRegions = getRegionsForSlot(regions, 'right');
    const columnRatio = layout.options?.columnRatio || '1:1';
    const gap = layout.options?.gap || '1rem';

    // Parse ratio to grid template
    const [left, right] = columnRatio.split(':').map(Number);
    const gridTemplate = `${left}fr ${right}fr`;

    return (
        <div
            className="fusion-layout fusion-layout-two-column"
            style={{
                display: 'grid',
                gridTemplateColumns: gridTemplate,
                gap,
            }}
        >
            <div className="fusion-layout-column fusion-layout-column-left">
                {leftRegions.map((region, index) => (
                    <RegionRenderer
                        key={region.id || `left-${index}`}
                        region={region}
                        data={data}
                        context={context}
                        onAction={onAction}
                        onUpdate={onUpdate}
                        onNavigate={onNavigate}
                    />
                ))}
            </div>
            <div className="fusion-layout-column fusion-layout-column-right">
                {rightRegions.map((region, index) => (
                    <RegionRenderer
                        key={region.id || `right-${index}`}
                        region={region}
                        data={data}
                        context={context}
                        onAction={onAction}
                        onUpdate={onUpdate}
                        onNavigate={onNavigate}
                    />
                ))}
            </div>
        </div>
    );
}

/**
 * Render a three-column layout.
 */
function ThreeColumnLayout({
    layout,
    regions,
    data,
    context,
    onAction,
    onUpdate,
    onNavigate,
}: PageLayoutRendererProps) {
    const leftRegions = getRegionsForSlot(regions, 'left');
    const centerRegions = getRegionsForSlot(regions, 'center');
    const rightRegions = getRegionsForSlot(regions, 'right');
    const columnRatio = layout.options?.columnRatio || '1:2:1';
    const gap = layout.options?.gap || '1rem';

    // Parse ratio to grid template
    const parts = columnRatio.split(':').map(Number);
    const gridTemplate = parts.map((p: number) => `${p}fr`).join(' ');

    return (
        <div
            className="fusion-layout fusion-layout-three-column"
            style={{
                display: 'grid',
                gridTemplateColumns: gridTemplate,
                gap,
            }}
        >
            <div className="fusion-layout-column fusion-layout-column-left">
                {leftRegions.map((region, index) => (
                    <RegionRenderer
                        key={region.id || `left-${index}`}
                        region={region}
                        data={data}
                        context={context}
                        onAction={onAction}
                        onUpdate={onUpdate}
                        onNavigate={onNavigate}
                    />
                ))}
            </div>
            <div className="fusion-layout-column fusion-layout-column-center">
                {centerRegions.map((region, index) => (
                    <RegionRenderer
                        key={region.id || `center-${index}`}
                        region={region}
                        data={data}
                        context={context}
                        onAction={onAction}
                        onUpdate={onUpdate}
                        onNavigate={onNavigate}
                    />
                ))}
            </div>
            <div className="fusion-layout-column fusion-layout-column-right">
                {rightRegions.map((region, index) => (
                    <RegionRenderer
                        key={region.id || `right-${index}`}
                        region={region}
                        data={data}
                        context={context}
                        onAction={onAction}
                        onUpdate={onUpdate}
                        onNavigate={onNavigate}
                    />
                ))}
            </div>
        </div>
    );
}

/**
 * Render a tabs layout.
 */
function TabsLayout({
    layout,
    regions,
    data,
    context,
    onAction,
    onUpdate,
    onNavigate,
}: PageLayoutRendererProps) {
    const [activeTab, setActiveTab] = React.useState(
        layout.options?.defaultTab || regions[0]?.id || 'tab-0'
    );

    // Group regions by their id (each region is a tab)
    const tabRegions = regions.filter((r) => r.slot === 'tab' || !r.slot);

    return (
        <div className="fusion-layout fusion-layout-tabs">
            <div className="fusion-layout-tabs-header" role="tablist">
                {tabRegions.map((region, index) => {
                    const tabId = region.id || `tab-${index}`;
                    const isActive = activeTab === tabId;

                    return (
                        <button
                            key={tabId}
                            role="tab"
                            aria-selected={isActive}
                            className={`fusion-layout-tab ${isActive ? 'active' : ''}`}
                            onClick={() => setActiveTab(tabId)}
                        >
                            {region.title || `Tab ${index + 1}`}
                        </button>
                    );
                })}
            </div>
            <div className="fusion-layout-tabs-content">
                {tabRegions.map((region, index) => {
                    const tabId = region.id || `tab-${index}`;
                    const isActive = activeTab === tabId;

                    if (!isActive) return null;

                    return (
                        <div
                            key={tabId}
                            role="tabpanel"
                            className="fusion-layout-tab-panel"
                        >
                            <RegionRenderer
                                region={region}
                                data={data}
                                context={context}
                                onAction={onAction}
                                onUpdate={onUpdate}
                                onNavigate={onNavigate}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/**
 * Render an accordion layout.
 */
function AccordionLayout({
    layout,
    regions,
    data,
    context,
    onAction,
    onUpdate,
    onNavigate,
}: PageLayoutRendererProps) {
    const allowMultiple = layout.options?.allowMultiple ?? false;
    const defaultExpanded = layout.options?.defaultExpanded || [];

    const [expanded, setExpanded] = React.useState<Set<string>>(
        new Set(defaultExpanded)
    );

    const toggleSection = (id: string) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                if (!allowMultiple) {
                    next.clear();
                }
                next.add(id);
            }
            return next;
        });
    };

    // Group regions by their id (each region is an accordion section)
    const sectionRegions = regions.filter((r) => r.slot === 'section' || !r.slot);

    return (
        <div className="fusion-layout fusion-layout-accordion">
            {sectionRegions.map((region, index) => {
                const sectionId = region.id || `section-${index}`;
                const isExpanded = expanded.has(sectionId);

                return (
                    <div
                        key={sectionId}
                        className={`fusion-layout-accordion-section ${isExpanded ? 'expanded' : ''}`}
                    >
                        <button
                            className="fusion-layout-accordion-header"
                            onClick={() => toggleSection(sectionId)}
                            aria-expanded={isExpanded}
                        >
                            <span className="fusion-layout-accordion-title">
                                {region.title || `Section ${index + 1}`}
                            </span>
                            <span className="fusion-layout-accordion-icon">
                                {isExpanded ? '−' : '+'}
                            </span>
                        </button>
                        {isExpanded && (
                            <div className="fusion-layout-accordion-content">
                                <RegionRenderer
                                    region={region}
                                    data={data}
                                    context={context}
                                    onAction={onAction}
                                    onUpdate={onUpdate}
                                    onNavigate={onNavigate}
                                />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

/**
 * Main layout renderer component.
 * Dispatches to specific layout implementations based on layout type.
 */
export function PageLayoutRenderer(props: PageLayoutRendererProps) {
    const { layout, className } = props;

    // Select layout implementation
    let LayoutComponent: React.ComponentType<PageLayoutRendererProps>;

    switch (layout.type) {
        case 'single':
            LayoutComponent = SingleColumnLayout as React.ComponentType<PageLayoutRendererProps>;
            break;
        case 'sidebar-left':
            LayoutComponent = SidebarLeftLayout;
            break;
        case 'sidebar-right':
            LayoutComponent = SidebarRightLayout;
            break;
        case 'two-column':
            LayoutComponent = TwoColumnLayout;
            break;
        case 'three-column':
            LayoutComponent = ThreeColumnLayout;
            break;
        case 'tabs':
            LayoutComponent = TabsLayout;
            break;
        case 'accordion':
            LayoutComponent = AccordionLayout;
            break;
        default:
            // Default to single column
            LayoutComponent = SingleColumnLayout as React.ComponentType<PageLayoutRendererProps>;
    }

    return (
        <div className={`fusion-layout-wrapper ${className || ''}`}>
            <LayoutComponent {...props} />
        </div>
    );
}
