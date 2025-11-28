import type { InteractionCollection } from "../InteractionCollection.js";
import type { SkillCollection } from "../SkillCollection.js";
import type { ToolCollection } from "../ToolCollection.js";
import type { ICollection, SkillDefinition, Tool } from "../types.js";
import { baseStyles } from "./styles.js";

/**
 * Default icon SVG for collections without a custom icon
 */
const defaultIcon = /*html*/`
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
</svg>`;

/**
 * Render a collection card for the index page
 */
export function collectionCard(collection: ICollection, pathPrefix: string): string {
    return /*html*/`
<a class="card" href="/${pathPrefix}/${collection.name}">
    <div class="card-icon">${collection.icon || defaultIcon}</div>
    <div class="card-title">${collection.title || collection.name}</div>
    <div class="card-desc">${collection.description || ''}</div>
</a>`;
}

/**
 * Render a tool card
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
 * Render a skill card
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

/**
 * Render the main index page
 */
export function indexPage(
    tools: ToolCollection[],
    skills: SkillCollection[],
    interactions: InteractionCollection[],
    title = "Tools Server"
): string {
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
    <h1>${title}</h1>

    ${tools.length > 0 ? /*html*/`
    <h2>Tool Collections</h2>
    <div class="card-grid">
        ${tools.map(t => collectionCard(t, 'tools')).join('')}
    </div>
    ` : ''}

    ${skills.length > 0 ? /*html*/`
    <hr>
    <h2>Skill Collections</h2>
    <div class="card-grid">
        ${skills.map(s => collectionCard(s, 'skills')).join('')}
    </div>
    ` : ''}

    ${interactions.length > 0 ? /*html*/`
    <hr>
    <h2>Interaction Collections</h2>
    <div class="card-grid">
        ${interactions.map(i => collectionCard(i, 'interactions')).join('')}
    </div>
    ` : ''}
</body>
</html>`;
}

/**
 * Render a tool collection detail page
 */
export function toolCollectionPage(collection: ToolCollection): string {
    return /*html*/`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${collection.title || collection.name}</title>
    <style>${baseStyles}</style>
</head>
<body>
    <div class="header">
        <div class="header-icon">${collection.icon || defaultIcon}</div>
        <div>
            <h1>${collection.title || collection.name}</h1>
            <div class="endpoint-url">Endpoint: <code>/api/tools/${collection.name}</code></div>
        </div>
    </div>
    <p>${collection.description || ''}</p>

    <h2>Tools</h2>
    <div class="item-list">
        ${Array.from(collection).map(toolCard).join('')}
    </div>
</body>
</html>`;
}

/**
 * Render a skill collection detail page
 */
export function skillCollectionPage(collection: SkillCollection): string {
    return /*html*/`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${collection.title || collection.name}</title>
    <style>${baseStyles}</style>
</head>
<body>
    <div class="header">
        <div class="header-icon">${collection.icon || defaultIcon}</div>
        <div>
            <h1>${collection.title || collection.name}</h1>
            <div class="endpoint-url">Endpoint: <code>/api/skills/${collection.name}</code></div>
        </div>
    </div>
    <p>${collection.description || ''}</p>

    <h2>Skills</h2>
    <div class="item-list">
        ${Array.from(collection).map(skillCard).join('')}
    </div>
</body>
</html>`;
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
    <title>${collection.title || collection.name}</title>
    <style>${baseStyles}</style>
</head>
<body>
    <div class="header">
        <div class="header-icon">${collection.icon || defaultIcon}</div>
        <div>
            <h1>${collection.title || collection.name}</h1>
            <div class="endpoint-url">Endpoint: <code>/api/interactions/${collection.name}</code></div>
        </div>
    </div>
    <p>${collection.description || ''}</p>

    <h2>Interactions</h2>
    <div class="item-list">
        ${collection.interactions.map(inter => /*html*/`
        <div class="item-card interaction">
            <div class="item-name">${inter.name}</div>
            <div class="item-desc">${inter.description || ''}</div>
            ${inter.tags?.length ? /*html*/`
            <div class="item-meta">
                ${inter.tags.map(tag => `<span class="badge">${tag}</span>`).join('')}
            </div>
            ` : ''}
        </div>
        `).join('')}
    </div>
</body>
</html>`;
}
