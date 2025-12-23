import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import type {
    SkillContentType,
    SkillDefinition
} from "./types.js";

/**
 * @derecated This feature is depreacted - use JOSN definition instead and import skill promts using ?raw
 */


interface SkillFrontmatter {
    name: string;
    title?: string;
    description: string;
    keywords?: string[];
    tools?: string[];
    widgets?: string[];
    data_patterns?: string[];
    language?: string;
    packages?: string[];
    system_packages?: string[];
}

/**
 * Parse a SKILL.md or SKILL.jst file content into a SkillDefinition.
 *
 * Format:
 * ```
 * ---
 * name: skill-name
 * description: Short description
 * keywords: [keyword1, keyword2]
 * tools: [tool1, tool2]
 * language: python
 * packages: [numpy, pandas]
 * ---
 *
 * # Instructions
 *
 * Your markdown/jst content here...
 * ```
 * @deprecated use JSON definitions instead and import ?raw for prompts
 */
export function parseSkillFile(
    content: string,
    contentType: SkillContentType
): SkillDefinition {
    // Parse YAML frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

    if (!frontmatterMatch) {
        throw new Error("Invalid skill file: missing YAML frontmatter");
    }

    const [, yamlContent, body] = frontmatterMatch;
    const frontmatter = parseYamlFrontmatter(yamlContent);
    const instructions = body.trim();

    if (!frontmatter.name) {
        throw new Error("Skill file missing required 'name' field");
    }
    if (!frontmatter.description) {
        throw new Error("Skill file missing required 'description' field");
    }

    const skill: SkillDefinition = {
        name: frontmatter.name,
        title: frontmatter.title,
        description: frontmatter.description,
        widgets: frontmatter.widgets,
        instructions,
        content_type: contentType,
    };

    // Build context triggers
    if (frontmatter.keywords || frontmatter.tools || frontmatter.data_patterns) {
        skill.context_triggers = {
            keywords: frontmatter.keywords,
            tool_names: frontmatter.tools,
            data_patterns: frontmatter.data_patterns,
        };
    }

    // Build execution config
    if (frontmatter.language) {
        skill.execution = {
            language: frontmatter.language,
            packages: frontmatter.packages,
            system_packages: frontmatter.system_packages,
        };

        // Extract code template from instructions if present
        const codeBlockMatch = instructions.match(/```(?:python|javascript|typescript|js|ts|py)\n([\s\S]*?)```/);
        if (codeBlockMatch) {
            skill.execution.template = codeBlockMatch[1].trim();
        }
    }

    // Related tools from frontmatter
    if (frontmatter.tools) {
        skill.related_tools = frontmatter.tools;
    }

    return skill;
}

/**
 * Simple YAML frontmatter parser (handles basic key: value and arrays)
 * @deprecated use JSON definitions instead and import ?raw for prompts
 */
function parseYamlFrontmatter(yaml: string): SkillFrontmatter {
    const result: Record<string, any> = {};
    const lines = yaml.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const colonIndex = trimmed.indexOf(':');
        if (colonIndex === -1) continue;

        const key = trimmed.slice(0, colonIndex).trim();
        let value = trimmed.slice(colonIndex + 1).trim();

        // Handle array syntax: [item1, item2]
        if (value.startsWith('[') && value.endsWith(']')) {
            const items = value.slice(1, -1).split(',').map(s => s.trim());
            result[key] = items.filter(s => s.length > 0);
        } else {
            // Remove quotes if present
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            result[key] = value;
        }
    }

    return result as SkillFrontmatter;
}

/**
 * Helper to load skill from file path (for Node.js usage)
 * @deprecated use JSON definitions instead and import ?raw for prompts
 */
export async function loadSkillFromFile(
    filePath: string,
    fs: { readFile: (path: string, encoding: string) => Promise<string> }
): Promise<SkillDefinition> {
    const content = await fs.readFile(filePath, 'utf-8');
    const contentType: SkillContentType = filePath.endsWith('.jst') ? 'jst' : 'md';
    return parseSkillFile(content, contentType);
}

/**
 * Load all skills from a directory.
 * Scans for subdirectories containing SKILL.md files.
 *
 * Directory structure:
 * ```
 * skills/
 *   nagare/
 *     fund-onboarding/
 *       SKILL.md
 *     monte-carlo/
 *       SKILL.md
 * ```
 *
 * @param dirPath - Path to the skills collection directory
 * @returns Array of parsed skill definitions
 * @deprecated use JSON definitions instead and import ?raw for prompts
 */
export function loadSkillsFromDirectory(dirPath: string): SkillDefinition[] {
    const skills: SkillDefinition[] = [];

    let entries: string[];
    try {
        entries = readdirSync(dirPath);
    } catch {
        console.warn(`Could not read skills directory: ${dirPath}`);
        return skills;
    }

    for (const entry of entries) {
        const entryPath = join(dirPath, entry);

        try {
            const stat = statSync(entryPath);
            if (!stat.isDirectory()) continue;

            // Look for SKILL.md or SKILL.jst
            const mdPath = join(entryPath, "SKILL.md");
            const jstPath = join(entryPath, "SKILL.jst");

            let content: string | undefined;
            let contentType: SkillContentType = 'md';

            if (existsSync(mdPath)) {
                content = readFileSync(mdPath, "utf-8");
                contentType = 'md';
            } else if (existsSync(jstPath)) {
                content = readFileSync(jstPath, "utf-8");
                contentType = 'jst';
            }

            if (content) {
                skills.push(parseSkillFile(content, contentType));
            }
        } catch (err) {
            console.warn(`Error loading skill from ${entryPath}:`, err);
        }
    }

    return skills;
}
