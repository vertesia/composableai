import type { InteractionCollection } from "../InteractionCollection.js";
import { ToolServerConfig } from "../server/types.js";
import type { SkillCollection } from "../SkillCollection.js";
import type { RenderingTemplateCollection } from "../RenderingTemplateCollection.js";
import type { ToolCollection } from "../ToolCollection.js";
import type { ContentTypesCollection } from "../ContentTypesCollection.js";
import type { ICollection, SkillDefinition, RenderingTemplateDefinition, Tool } from "../types.js";
import { join } from "../utils.js";
import { baseStyles } from "./styles.js";

type MCPProviderMeta = {
    name: string;
    description?: string;
};

/**
 * Default icon SVG for collections without a custom icon
 */
const defaultIcon = /*html*/`
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
</svg>`;

const skillIcon = /*html*/`
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
</svg>`;

const templateIcon = /*html*/`
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
  <polyline points="14 2 14 8 20 8"/>
  <line x1="16" y1="13" x2="8" y2="13"/>
  <line x1="16" y1="17" x2="8" y2="17"/>
  <polyline points="10 9 9 9 8 9"/>
</svg>`;

/**
 * Extended styles for detail pages
 */
const detailStyles = /*css*/`
${baseStyles}

.nav {
    margin-bottom: 1.5rem;
}

.nav a {
    color: #6b7280;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
}

.nav a:hover {
    color: #2563eb;
}

.nav svg {
    width: 16px;
    height: 16px;
}

.detail-card {
    background: white;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    margin-bottom: 1.5rem;
    overflow: hidden;
}

.detail-header {
    padding: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
}

.detail-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: #111827;
    margin: 0 0 0.25rem 0;
    font-family: ui-monospace, monospace;
}

.detail-desc {
    color: #6b7280;
    font-size: 0.95rem;
    margin: 0;
}

.detail-badges {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
}

.detail-body {
    padding: 1.5rem;
}

.detail-section {
    margin-bottom: 1.5rem;
}

.detail-section:last-child {
    margin-bottom: 0;
}

.detail-section-title {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #9ca3af;
    margin: 0 0 0.75rem 0;
}

.schema-block {
    background: #1f2937;
    color: #e5e7eb;
    padding: 1rem;
    border-radius: 8px;
    font-family: ui-monospace, monospace;
    font-size: 0.8rem;
    overflow-x: auto;
    white-space: pre;
    line-height: 1.5;
}

.schema-block .key { color: #93c5fd; }
.schema-block .string { color: #86efac; }
.schema-block .number { color: #fcd34d; }
.schema-block .boolean { color: #f9a8d4; }
.schema-block .null { color: #9ca3af; }

.info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
}

.info-item {
    background: #f9fafb;
    padding: 1rem;
    border-radius: 8px;
}

.info-label {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #9ca3af;
    margin-bottom: 0.25rem;
}

.info-value {
    font-size: 0.95rem;
    color: #111827;
}

.info-value code {
    background: #e5e7eb;
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
    font-family: ui-monospace, monospace;
    font-size: 0.85rem;
}

.package-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
}

.package-tag {
    background: #dbeafe;
    color: #1e40af;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.8rem;
    font-family: ui-monospace, monospace;
}

.script-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.script-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: #f9fafb;
    border-radius: 8px;
}

.script-icon {
    width: 20px;
    height: 20px;
    color: #6b7280;
}

.script-name {
    font-family: ui-monospace, monospace;
    font-size: 0.9rem;
    color: #111827;
}

.keyword-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
}

.keyword-tag {
    background: #fef3c7;
    color: #92400e;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.8rem;
}

.instructions-preview {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 1rem;
    max-height: 300px;
    overflow-y: auto;
    font-size: 0.875rem;
    line-height: 1.6;
    color: #374151;
    white-space: pre-wrap;
}

.empty-state {
    text-align: center;
    padding: 3rem;
    color: #9ca3af;
}

.tool-type-badge {
    background: #6366f1;
    color: white;
}

.skill-type-badge {
    background: #10b981;
    color: white;
}

.template-type-badge {
    background: #f59e0b;
    color: white;
}

.template-type-badge.document {
    background: #f59e0b;
}

.template-type-badge.presentation {
    background: #8b5cf6;
}

@media (prefers-color-scheme: dark) {
    .nav a {
        color: #9ca3af;
    }

    .nav a:hover {
        color: #60a5fa;
    }

    .detail-card {
        background: rgba(15, 23, 42, 0.96);
        box-shadow:
            0 18px 40px rgba(15, 23, 42, 0.9),
            0 0 0 1px rgba(15, 23, 42, 0.9);
    }

    .detail-header {
        border-bottom-color: rgba(55, 65, 81, 0.9);
    }

    .detail-title {
        color: #e5e7eb;
    }

    .detail-desc {
        color: #9ca3af;
    }

    .detail-section-title {
        color: #9ca3af;
    }

    .info-item {
        background: rgba(15, 23, 42, 0.9);
    }

    .info-value {
        color: #e5e7eb;
    }

    .info-value code {
        background: rgba(31, 41, 55, 0.9);
        color: #e5e7eb;
    }

    .script-item {
        background: rgba(15, 23, 42, 0.9);
    }

    .script-name {
        color: #e5e7eb;
    }

    .keyword-tag {
        background: rgba(250, 204, 21, 0.12);
        color: #facc15;
    }

    .instructions-preview {
        background: rgba(15, 23, 42, 0.9);
        border-color: rgba(55, 65, 81, 0.9);
        color: #e5e7eb;
    }

    .empty-state {
        color: #9ca3af;
    }
}
`;

/**
 * Syntax highlight JSON
 */
function highlightJson(obj: unknown): string {
    const json = JSON.stringify(obj, null, 2);
    return json
        .replace(/"([^"]+)":/g, '<span class="key">"$1"</span>:')
        .replace(/: "([^"]*)"([,\n])/g, ': <span class="string">"$1"</span>$2')
        .replace(/: (\d+)([,\n])/g, ': <span class="number">$1</span>$2')
        .replace(/: (true|false)([,\n])/g, ': <span class="boolean">$1</span>$2')
        .replace(/: (null)([,\n])/g, ': <span class="null">$1</span>$2');
}

/**
 * Back navigation arrow
 */
const backArrow = /*html*/`
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path d="M19 12H5M12 19l-7-7 7-7"/>
</svg>`;

/**
 * Copy icon
 */
const copyIcon = /*html*/`
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
</svg>`;

/**
 * File icon
 */
const fileIcon = /*html*/`
<svg class="script-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
  <polyline points="14 2 14 8 20 8"></polyline>
</svg>`;

/**
 * Render a collection card for the index page
 */
export function collectionCard(collection: ICollection, pathPrefix: string, meta?: string): string {
    return /*html*/`
<a class="card" href="/${pathPrefix}/${collection.name}" data-collection-type="${pathPrefix}" data-collection-name="${collection.name}">
    <div class="card-icon">${collection.icon || defaultIcon}</div>
    <div class="card-title">${collection.title || collection.name}</div>
    <div class="card-desc">${collection.description || ''}</div>
    ${meta ? `<div class="card-meta">${meta}</div>` : ''}
</a>`;
}

/**
 * Render a tool card (simple version for lists)
 */
export function toolCard(tool: Tool<Record<string, unknown>>): string {
    return /*html*/`
<div class="item-card">
    <div class="item-name">${tool.name}</div>
    <div class="item-desc">${tool.description || ''}</div>
    ${tool.input_schema ? /*html*/`
    <div class="item-schema">${JSON.stringify(tool.input_schema, null, 2)}</div>
    ` : ''}
</div>`;
}

/**
 * Render an MCP provider card
 */
export function mcpProviderCard(provider: MCPProviderMeta): string {
    return /*html*/`
<a class="card" href="/api/mcp/${provider.name}">
    <div class="card-title">${provider.name}</div>
    <div class="card-desc">${provider.description || ''}</div>
</a>`;
}

/**
 * Render a detailed tool card
 */
export function toolDetailCard(tool: Tool<Record<string, unknown>>, collectionName: string): string {
    const schema = tool.input_schema;
    const properties = (schema as Record<string, unknown>)?.properties as Record<string, unknown> | undefined;
    const required = (schema as Record<string, unknown>)?.required as string[] | undefined;

    return /*html*/`
<div class="detail-card">
    <div class="detail-header">
        <div>
            <h3 class="detail-title">${tool.name}</h3>
            <p class="detail-desc">${tool.description || 'No description'}</p>
        </div>
        <div class="detail-badges">
            <span class="badge tool-type-badge">Tool</span>
        </div>
    </div>
    <div class="detail-body">
        <div class="detail-section">
            <h4 class="detail-section-title">Endpoint</h4>
            <div class="endpoint-box">
                <code>POST /api/tools/${collectionName}</code>
                <button class="copy-btn" onclick="navigator.clipboard.writeText('/api/tools/${collectionName}')" title="Copy">
                    ${copyIcon}
                </button>
            </div>
        </div>

        ${schema ? /*html*/`
        <div class="detail-section">
            <h4 class="detail-section-title">Input Schema</h4>
            ${properties ? /*html*/`
            <div class="info-grid" style="margin-bottom: 1rem;">
                ${Object.entries(properties).map(([key, value]) => {
        const prop = value as Record<string, unknown>;
        const isRequired = required?.includes(key);
        return /*html*/`
                    <div class="info-item">
                        <div class="info-label">${key}${isRequired ? ' *' : ''}</div>
                        <div class="info-value">
                            <code>${prop.type || 'any'}</code>
                            ${prop.description ? `<br><span style="color: #6b7280; font-size: 0.85rem;">${prop.description}</span>` : ''}
                        </div>
                    </div>`;
    }).join('')}
            </div>
            ` : ''}
            <details>
                <summary style="cursor: pointer; color: #6b7280; font-size: 0.85rem;">View full schema</summary>
                <div class="schema-block" style="margin-top: 0.75rem;">${highlightJson(schema)}</div>
            </details>
        </div>
        ` : /*html*/`
        <div class="detail-section">
            <div class="empty-state">No input schema defined</div>
        </div>
        `}
    </div>
</div>`;
}

/**
 * Render a skill card (simple version for lists)
 */
export function skillCard(skill: SkillDefinition): string {
    return /*html*/`
<div class="item-card skill">
    <div class="item-name">${skill.name}</div>
    <div class="item-desc">${skill.description || ''}</div>
    <div class="item-meta">
        <span class="badge ${skill.execution?.language || ''}">${skill.content_type === 'jst' ? 'Dynamic' : 'Static'}</span>
        ${skill.execution?.language ? `<span class="badge ${skill.execution.language}">${skill.execution.language}</span>` : ''}
        ${skill.scripts?.length ? `<span class="badge">${skill.scripts.length} script${skill.scripts.length > 1 ? 's' : ''}</span>` : ''}
    </div>
</div>`;
}

function skillWidgetsTemplate(skillWidgets: string[] | undefined) {
    if (!skillWidgets || skillWidgets.length === 0) {
        return 'n/a';
    }
    return skillWidgets.map(w => `<div style='display: flex; align-items: center; gap: 0.5rem; width:100%;justify-content: space-between;'><span>${w}</span>
        <button class="copy-btn" onclick="navigator.clipboard.writeText(window.location.origin + '/widgets/${w}.js')" title="Copy endpoint URL">
            ${copyIcon}
        </button>
    </div>`).join('');
}

function renderSkillUrl(skill: SkillDefinition, collectionName: string): string {
    const skillPath = `/api/skills/${collectionName}/${skill.name}`;
    return /*html*/`<div class="script-item" style='display: flex; align-items: center; gap: 0.5rem; width:100%;justify-content: space-between;'><span class="script-name">${skillPath}</span>
        <button class="copy-btn" onclick="navigator.clipboard.writeText(window.location.origin + '${skillPath}')" title="Copy endpoint URL">
            ${copyIcon}
        </button>
    </div>`;
}

/**
 * Render a detailed skill card
 */
export function skillDetailCard(skill: SkillDefinition, collection: SkillCollection): string {
    const hasKeywords = skill.context_triggers?.keywords?.length;
    const hasPackages = skill.execution?.packages?.length;
    const hasScripts = skill.scripts?.length;
    const hasRelatedTools = skill.related_tools?.length;

    return /*html*/`
<div class="detail-card">
    <div class="detail-header">
        <div>
            <h3 class="detail-title">${skill.name}</h3>
            <p class="detail-desc">${skill.description || 'No description'}</p>
            ${renderSkillUrl(skill, collection.name)}
        </div>
        <div class="detail-badges">
            <span class="badge skill-type-badge">Skill</span>
            ${skill.execution?.language ? `<span class="badge ${skill.execution.language}">${skill.execution.language}</span>` : ''}
            ${hasRelatedTools ? `<span class="badge" style="background: #8b5cf6; color: white;">Unlocks ${skill.related_tools?.length} tool${skill.related_tools?.length !== 1 ? 's' : ''}</span>` : ''}
        </div>
    </div>
    <div class="detail-body">
        <div class="info-grid">
            <div class="info-item">
                <div class="info-label">Content Type</div>
                <div class="info-value">${skill.content_type === 'jst' ? 'Dynamic (JST Template)' : 'Static (Markdown)'}</div>
            </div>
            ${skill.execution?.language ? /*html*/`
            <div class="info-item">
                <div class="info-label">Language</div>
                <div class="info-value"><code>${skill.execution.language}</code></div>
            </div>
            ` : ''}
            <div class="info-item">
                <div class="info-label">Widgets</div>
                <div class="info-value">${skillWidgetsTemplate(skill.widgets)}</div>
            </div>
        </div>

        ${hasRelatedTools ? /*html*/`
        <div class="detail-section">
            <h4 class="detail-section-title">Unlocks Tools</h4>
            <p style="color: #6b7280; font-size: 0.85rem; margin: 0 0 0.75rem 0;">These tools become available when this skill is activated:</p>
            <div class="package-list">
                ${skill.related_tools?.map(tool => `<span class="package-tag" style="background: #ede9fe; color: #6d28d9;">${tool}</span>`).join('')}
            </div>
        </div>
        ` : ''}

        ${hasKeywords ? /*html*/`
        <div class="detail-section">
            <h4 class="detail-section-title">Trigger Keywords</h4>
            <div class="keyword-list">
                ${skill.context_triggers?.keywords?.map(kw => `<span class="keyword-tag">${kw}</span>`).join('')}
            </div>
        </div>
        ` : ''}

        ${hasPackages ? /*html*/`
        <div class="detail-section">
            <h4 class="detail-section-title">Required Packages</h4>
            <div class="package-list">
                ${skill.execution?.packages?.map(pkg => `<span class="package-tag">${pkg}</span>`).join('')}
            </div>
        </div>
        ` : ''}

        ${hasScripts ? /*html*/`
        <div class="detail-section">
            <h4 class="detail-section-title">Bundled Scripts</h4>
            <div class="script-list">
                ${skill.scripts?.map(script => /*html*/`
                <div class="script-item">
                    ${fileIcon}
                    <span class="script-name">${join("/scripts", script)}</span>
                </div>
                `).join('')}
            </div>
        </div>
        ` : ''}

        <div class="detail-section">
            <h4 class="detail-section-title">Instructions Preview</h4>
            <div class="instructions-preview">${escapeHtml(skill.instructions.slice(0, 1000))}${skill.instructions.length > 1000 ? '...' : ''}</div>
        </div>
    </div>
</div>`;
}

/**
 * Render a template endpoint URL with copy button
 */
function renderTemplateUrl(template: RenderingTemplateDefinition, collectionName: string): string {
    const templatePath = `/api/templates/${collectionName}/${template.name}`;
    return /*html*/`<div class="script-item" style='display: flex; align-items: center; gap: 0.5rem; width:100%;justify-content: space-between;'><span class="script-name">${templatePath}</span>
        <button class="copy-btn" onclick="navigator.clipboard.writeText(window.location.origin + '${templatePath}')" title="Copy endpoint URL">
            ${copyIcon}
        </button>
    </div>`;
}

/**
 * Render a tag list
 */
function tagList(tags: string[] | undefined): string {
    if (!tags || tags.length === 0) return '';
    return /*html*/`
    <div class="detail-section">
        <h4 class="detail-section-title">Tags</h4>
        <div class="keyword-list">
            ${tags.map(tag => `<span class="keyword-tag">${tag}</span>`).join('')}
        </div>
    </div>`;
}

/**
 * Render an asset file list
 */
function assetList(assets: string[]): string {
    if (assets.length === 0) return '';
    return /*html*/`
    <div class="detail-section">
        <h4 class="detail-section-title">Assets</h4>
        <div class="script-list">
            ${assets.map(asset => /*html*/`
            <div class="script-item">
                ${fileIcon}
                <span class="script-name">${asset}</span>
            </div>
            `).join('')}
        </div>
    </div>`;
}

/**
 * Render an instructions preview section
 */
function instructionsPreview(instructions: string): string {
    return /*html*/`
    <div class="detail-section">
        <h4 class="detail-section-title">Instructions Preview</h4>
        <div class="instructions-preview">${escapeHtml(instructions.slice(0, 1000))}${instructions.length > 1000 ? '...' : ''}</div>
    </div>`;
}

/**
 * Render a detailed template card
 */
export function templateDetailCard(template: RenderingTemplateDefinition, collection: RenderingTemplateCollection): string {
    return /*html*/`
<div class="detail-card">
    <div class="detail-header">
        <div>
            <h3 class="detail-title">${template.title || template.name}</h3>
            <p class="detail-desc">${template.description || 'No description'}</p>
            ${renderTemplateUrl(template, collection.name)}
        </div>
        <div class="detail-badges">
            <span class="badge template-type-badge ${template.type}">${template.type}</span>
        </div>
    </div>
    <div class="detail-body">
        <div class="info-grid">
            <div class="info-item">
                <div class="info-label">Type</div>
                <div class="info-value"><code>${template.type}</code></div>
            </div>
            <div class="info-item">
                <div class="info-label">Assets</div>
                <div class="info-value">${template.assets.length} file${template.assets.length !== 1 ? 's' : ''}</div>
            </div>
        </div>

        ${tagList(template.tags)}
        ${assetList(template.assets)}
        ${instructionsPreview(template.instructions)}
    </div>
</div>`;
}

/**
 * Render a template collection detail page
 */
export function templateCollectionPage(collection: RenderingTemplateCollection): string {
    const templatesArray = Array.from(collection);
    return /*html*/`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${collection.title || collection.name} - Templates</title>
    <style>${detailStyles}</style>
</head>
<body>
    <nav class="nav">
        <a href="/">${backArrow} Back to all collections</a>
    </nav>

    <div class="header">
        <div class="header-icon">${collection.icon || templateIcon}</div>
        <div>
            <h1>${collection.title || collection.name}</h1>
            <p style="color: #6b7280; margin: 0.25rem 0 0 0;">${collection.description || ''}</p>
            <div class="endpoint-box">
                <code>/api/templates/${collection.name}</code>
                <button class="copy-btn" onclick="navigator.clipboard.writeText(window.location.origin + '/api/templates/${collection.name}')" title="Copy endpoint URL">
                    ${copyIcon}
                </button>
            </div>
        </div>
    </div>

    <h2>${templatesArray.length} Template${templatesArray.length !== 1 ? 's' : ''}</h2>

    ${templatesArray.length > 0 ?
            templatesArray.map(template => templateDetailCard(template, collection)).join('') :
            '<div class="empty-state">No templates in this collection</div>'
        }
</body>
</html>`;
}

/**
 * Escape HTML for safe rendering
 */
function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Derive simple initials from a title for use in the hero avatar.
 */
function getInitials(title: string): string {
    const words = title.trim().split(/\s+/).filter(Boolean);
    if (!words.length) return "TS";
    const initials = words
        .slice(0, 2)
        .map((word) => word.charAt(0).toUpperCase())
        .join("");
    return initials || "TS";
}

function renderUILinks() {
    const copyIconSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;

    return /*html*/`
<div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(156, 163, 175, 0.2); display: flex; gap: 1rem; flex-wrap: wrap; align-items: center;">
    <a target="_blank" href="/ui/" class="plugin-link-primary" style="display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; font-size: 0.875rem; font-weight: 500; transition: background 0.15s;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="9" y1="3" x2="9" y2="21"></line>
        </svg>
        UI Plugin Dev
    </a>
    <div style="display: inline-flex; align-items: center; gap: 0.5rem;">
        <a href="/lib/plugin.js" class="plugin-link-secondary" style="display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; background: #10b981; color: white; text-decoration: none; border-radius: 6px; font-size: 0.875rem; font-weight: 500; transition: background 0.15s;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Plugin Bundle
        </a>
        <button id="copy-plugin-btn" class="copy-btn" onclick="copyPluginUrl(this)" title="Copy plugin URL" style="background: #e5e7eb; border: none; padding: 0.5rem; border-radius: 6px; cursor: pointer; color: #6b7280; transition: all 0.15s; display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px;">
            ${copyIconSvg}
        </button>
    </div>
</div>
<script>
function copyPluginUrl(btn) {
    navigator.clipboard.writeText(window.location.origin + '/lib/plugin.js');
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '✓';
    btn.style.color = '#10b981';
    setTimeout(function() {
        btn.innerHTML = originalHtml;
        btn.style.color = '#6b7280';
    }, 1500);
}
</script>
`;
}

/**
 * Render the main index page
 *
 * Note: The fourth argument is backward compatible:
 * - If a string is passed, it is treated as the title.
 * - If an array is passed, it is treated as MCP providers and the fifth argument (if any) is the title.
 * @deprecated Static templates were replaced by a React site. Do not use them anymore. 
 * Will be removed.
 */
export function indexPage(
    config: ToolServerConfig
): string {
    const {
        title = 'Tools Server',
        tools = [],
        interactions = [],
        skills = [],
        templates = [],
        types = [],
        mcpProviders = [],
        hideUILinks = false,
    } = config;


    return /*html*/`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>${baseStyles}</style>
</head>
<body>
    <div class="page">
        <header class="hero">
            <div class="hero-main">
                <div class="hero-logo">
                    <span class="hero-logo-initial">${escapeHtml(getInitials(title))}</span>
                </div>
                <div class="hero-meta">
                    <p class="hero-eyebrow">Tools Server</p>
                    <h1 class="hero-title">${title}</h1>
                    <p class="hero-tagline">
                        Discover the tools, skills, interactions, and content types exposed by this server.
                    </p>
                    <div class="hero-summary">
                        ${tools.length ? /*html*/`<span><dot></dot> ${tools.length} tool collection${tools.length !== 1 ? 's' : ''}</span>` : ''}
                        ${skills.length ? /*html*/`<span><dot></dot> ${skills.length} skill collection${skills.length !== 1 ? 's' : ''}</span>` : ''}
                        ${interactions.length ? /*html*/`<span><dot></dot> ${interactions.length} interaction collection${interactions.length !== 1 ? 's' : ''}</span>` : ''}
                        ${types.length ? /*html*/`<span><dot></dot> ${types.length} content type collection${types.length !== 1 ? 's' : ''}</span>` : ''}
                        ${templates.length ? /*html*/`<span><dot></dot> ${templates.length} template collection${templates.length !== 1 ? 's' : ''}</span>` : ''}
                        ${mcpProviders.length ? /*html*/`<span><dot></dot> ${mcpProviders.length} MCP provider${mcpProviders.length !== 1 ? 's' : ''}</span>` : ''}
                    </div>
                    ${hideUILinks ? '' : renderUILinks()}
                </div>
            </div>
            <aside class="hero-panel">
                <div class="hero-panel-label">Base endpoint</div>
                <div class="hero-panel-endpoint"><code>/api</code></div>
                <div class="hero-panel-label" style="margin-top: 1rem;">Package endpoint</div>
                <div class="endpoint-box" style="margin-top: 0.5rem;">
                    <code id="package-endpoint-url">/api/package</code>
                    <button class="copy-btn" onclick="copyPackageUrl(this)" title="Copy package endpoint URL">
                        ${copyIcon}
                    </button>
                </div>
                <p class="hero-panel-hint">
                    Use <strong>POST /api/tools/&lt;collection&gt;</strong> or
                    <strong>POST /api/skills/&lt;collection&gt;</strong> to call these from your apps or agents.
                </p>
            </aside>
        </header>

        <div class="search-bar">
            <input
                type="search"
                id="collection-search"
                class="search-input"
                placeholder="Search tools, skills, interactions, types, templates..."
                aria-label="Search collections"
                autocomplete="off"
            />
            <p class="search-hint">
                Filter collections by name or description. Search runs locally in your browser.
            </p>
            <p id="search-empty" class="search-empty" style="display: none;">
                No collections match this search.
            </p>
        </div>

        ${tools.length > 0 ? /*html*/`
        <section data-section="tools">
            <div class="section-header">
                <h2>Tool Collections</h2>
                <p class="section-subtitle">Remote tools available to agents via Vertesia.</p>
            </div>
            <div class="card-grid">
                ${tools.map(t => collectionCard(t, 'tools')).join('')}
            </div>
        </section>
        ` : ''}

        ${skills.length > 0 ? /*html*/`
        <section data-section="skills">
            <hr>
            <div class="section-header">
                <h2>Skill Collections</h2>
                <p class="section-subtitle">Reusable instructions and scripts packaged as tools.</p>
            </div>
            <div class="card-grid">
                ${skills.map(s => {
        const count = Array.from(s).length;
        return collectionCard(s, 'skills', `${count} skill${count !== 1 ? 's' : ''}`);
    }).join('')}
            </div>
        </section>
        ` : ''}

        ${interactions.length > 0 ? /*html*/`
        <section data-section="interactions">
            <hr>
            <div class="section-header">
                <h2>Interaction Collections</h2>
                <p class="section-subtitle">Conversation blueprints surfaced in the Vertesia UI.</p>
            </div>
            <div class="card-grid">
                ${interactions.map(i => collectionCard(i, 'interactions')).join('')}
            </div>
        </section>
        ` : ''}

        ${types.length > 0 ? /*html*/`
        <section data-section="types">
            <hr>
            <div class="section-header">
                <h2>Content Type Collections</h2>
                <p class="section-subtitle">Schema definitions for structured content in the data store.</p>
            </div>
            <div class="card-grid">
                ${types.map((t: ContentTypesCollection) => {
        const count = t.getContentTypes().length;
        return collectionCard(t, 'types', `${count} type${count !== 1 ? 's' : ''}`);
    }).join('')}
            </div>
        </section>
        ` : ''}

        ${templates.length > 0 ? /*html*/`
        <section data-section="templates">
            <hr>
            <div class="section-header">
                <h2>Rendering Template Collections</h2>
                <p class="section-subtitle">Document and presentation templates for content generation.</p>
            </div>
            <div class="card-grid">
                ${templates.map((t: RenderingTemplateCollection) => {
        const count = t.getTemplateDefinitions().length;
        return collectionCard(t, 'templates', `${count} template${count !== 1 ? 's' : ''}`);
    }).join('')}
            </div>
        </section>
        ` : ''}

        ${mcpProviders.length > 0 ? /*html*/`
        <section data-section="mcp">
            <hr>
            <div class="section-header">
                <h2>MCP Providers</h2>
                <p class="section-subtitle">Remote MCP servers available through this tools server.</p>
            </div>
            <div class="card-grid">
                ${mcpProviders.map(p => mcpProviderCard(p)).join('')}
            </div>
        </section>
        ` : ''}
    </div>
    <script>
    (function () {
        var input = document.getElementById('collection-search');
        if (!input) return;

        var cards = Array.prototype.slice.call(document.querySelectorAll('.card'));
        if (!cards.length) return;

        var sections = Array.prototype.slice.call(document.querySelectorAll('[data-section]'));
        var emptyState = document.getElementById('search-empty');

        function normalize(value) {
            return (value || '').toString().toLowerCase();
        }

        function update(query) {
            var q = normalize(query).trim();
            var anyVisible = false;

            cards.forEach(function (card) {
                var text = normalize(card.textContent);
                var match = !q || text.indexOf(q) !== -1;
                card.style.display = match ? '' : 'none';
                if (match) anyVisible = true;
            });

            sections.forEach(function (section) {
                var visibleCards = section.querySelectorAll('.card');
                var hasVisible = false;
                for (var i = 0; i < visibleCards.length; i++) {
                    var style = window.getComputedStyle(visibleCards[i]);
                    if (style.display !== 'none') {
                        hasVisible = true;
                        break;
                    }
                }
                section.style.display = hasVisible ? '' : 'none';
            });

            if (emptyState) {
                emptyState.style.display = q && !anyVisible ? '' : 'none';
            }
        }

        input.addEventListener('input', function () {
            update(input.value);
        });
    }());

    function copyPackageUrl(btn) {
        var url = window.location.origin + '/api/package';
        navigator.clipboard.writeText(url);
        var originalHtml = btn.innerHTML;
        btn.innerHTML = '✓';
        btn.style.color = '#10b981';
        setTimeout(function() {
            btn.innerHTML = originalHtml;
            btn.style.color = '#6b7280';
        }, 1500);
    }
    </script>
</body>
</html>`;
}

/**
 * Render a tool collection detail page
 */
export function toolCollectionPage(collection: ToolCollection): string {
    const toolsArray = Array.from(collection);
    return /*html*/`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${collection.title || collection.name} - Tools</title>
    <style>${detailStyles}</style>
</head>
<body>
    <nav class="nav">
        <a href="/">${backArrow} Back to all collections</a>
    </nav>

    <div class="header">
        <div class="header-icon">${collection.icon || defaultIcon}</div>
        <div>
            <h1>${collection.title || collection.name}</h1>
            <p style="color: #6b7280; margin: 0.25rem 0 0 0;">${collection.description || ''}</p>
            <div class="endpoint-box">
                <code>/api/tools/${collection.name}</code>
                <button class="copy-btn" onclick="navigator.clipboard.writeText(window.location.origin + '/api/tools/${collection.name}')" title="Copy endpoint URL">
                    ${copyIcon}
                </button>
            </div>
        </div>
    </div>

    <h2>${toolsArray.length} Tool${toolsArray.length !== 1 ? 's' : ''}</h2>

    ${toolsArray.length > 0 ?
            toolsArray.map(tool => toolDetailCard(tool, collection.name)).join('') :
            '<div class="empty-state">No tools in this collection</div>'
        }
</body>
</html>`;
}

/**
 * Render a skill collection detail page
 */
export function skillCollectionPage(collection: SkillCollection): string {
    const skillsArray = Array.from(collection);
    return /*html*/`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${collection.title || collection.name} - Skills</title>
    <style>${detailStyles}</style>
</head>
<body>
    <nav class="nav">
        <a href="/">${backArrow} Back to all collections</a>
    </nav>

    <div class="header">
        <div class="header-icon">${collection.icon || skillIcon}</div>
        <div>
            <h1>${collection.title || collection.name}</h1>
            <p style="color: #6b7280; margin: 0.25rem 0 0 0;">${collection.description || ''}</p>
            <div class="endpoint-box">
                <code>/api/skills/${collection.name}</code>
                <button class="copy-btn" onclick="navigator.clipboard.writeText(window.location.origin + '/api/skills/${collection.name}')" title="Copy endpoint URL">
                    ${copyIcon}
                </button>
            </div>
        </div>
    </div>

    <h2>${skillsArray.length} Skill${skillsArray.length !== 1 ? 's' : ''}</h2>

    ${skillsArray.length > 0 ?
            skillsArray.map(skill => skillDetailCard(skill, collection)).join('') :
            '<div class="empty-state">No skills in this collection</div>'
        }
</body>
</html>`;
}

/**
 * Render a collection header with icon, title, description, and endpoint
 */
function collectionDetailHeader(collection: ICollection, pathPrefix: string): string {
    return /*html*/`
    <nav class="nav">
        <a href="/">${backArrow} Back to all collections</a>
    </nav>

    <div class="header">
        <div class="header-icon">${collection.icon || defaultIcon}</div>
        <div>
            <h1>${collection.title || collection.name}</h1>
            <p style="color: #6b7280; margin: 0.25rem 0 0 0;">${collection.description || ''}</p>
            <div class="endpoint-box">
                <code>/api/${pathPrefix}/${collection.name}</code>
                <button class="copy-btn" onclick="navigator.clipboard.writeText(window.location.origin + '/api/${pathPrefix}/${collection.name}')" title="Copy endpoint URL">
                    ${copyIcon}
                </button>
            </div>
        </div>
    </div>`;
}

/**
 * Render a simple item card with name, description, and tags
 */
function simpleItemCard(item: { name: string; description?: string; tags?: string[] }): string {
    return /*html*/`
    <div class="detail-card">
        <div class="detail-header">
            <div>
                <h3 class="detail-title">${item.name}</h3>
                <p class="detail-desc">${item.description || 'No description'}</p>
            </div>
            <div class="detail-badges">
                ${item.tags?.map(tag => `<span class="badge">${tag}</span>`).join('') || ''}
            </div>
        </div>
    </div>`;
}

/**
 * Render an interaction collection detail page
 */
export function interactionCollectionPage(collection: InteractionCollection): string {
    return /*html*/`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${collection.title || collection.name} - Interactions</title>
    <style>${detailStyles}</style>
</head>
<body>
    ${collectionDetailHeader(collection, 'interactions')}

    <h2>${collection.interactions.length} Interaction${collection.interactions.length !== 1 ? 's' : ''}</h2>

    <div class="item-list">
        ${collection.interactions.map(inter => simpleItemCard(inter)).join('')}
    </div>
</body>
</html>`;
}

/**
 * Render a content type collection detail page
 */
export function contentTypeCollectionPage(collection: ContentTypesCollection): string {
    const typesArray = collection.getContentTypes();
    return /*html*/`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${collection.title || collection.name} - Content Types</title>
    <style>${detailStyles}</style>
</head>
<body>
    ${collectionDetailHeader(collection, 'types')}

    <h2>${typesArray.length} Content Type${typesArray.length !== 1 ? 's' : ''}</h2>

    <div class="item-list">
        ${typesArray.map(type => simpleItemCard(type)).join('')}
    </div>
</body>
</html>`;
}
