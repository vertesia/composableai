import type { ContentTypeValueHintsPolicy, RelationshipValueHintsResponse } from '@vertesia/common';

const MAX_PROMPT_CHARS = 12_000;

interface RelationshipHintsClient {
    store: {
        relationships: {
            valueHints(payload: {
                document_id: string;
                config: ContentTypeValueHintsPolicy;
                type_id?: string;
            }): Promise<RelationshipValueHintsResponse>;
        };
    };
}

/** Advisory spelling examples. The server enforces ACLs and the policy limits before returning values. */
export async function loadRelationshipValueHints(
    client: RelationshipHintsClient,
    documentId: string,
    config: ContentTypeValueHintsPolicy | undefined,
    typeId?: string,
): Promise<string | undefined> {
    if (!config?.fields.length) return undefined;
    const result = await client.store.relationships.valueHints({
        document_id: documentId,
        config,
        ...(typeId ? { type_id: typeId } : {}),
    });
    const fieldLimit = Math.min(config.fields.length, 10);
    const perFieldLimit = Math.min(config.max_values_per_field ?? 20, 50);
    let remaining = Math.min(config.max_total_values ?? 100, 200);
    let usedChars = 0;
    const lines: string[] = [];
    for (const field of result.fields.slice(0, fieldLimit)) {
        if (!config.fields.includes(field.field)) continue;
        const values = field.values.slice(0, Math.min(perFieldLimit, remaining));
        if (!values.length) continue;
        const entries: string[] = [];
        for (const { value, count } of values) {
            const entry = `${JSON.stringify(value)} (${count})`;
            const addedChars = entry.length + (entries.length ? 2 : field.field.length + 2 + (lines.length ? 1 : 0));
            if (usedChars + addedChars > MAX_PROMPT_CHARS) break;
            entries.push(entry);
            usedChars += addedChars;
            remaining--;
        }
        if (entries.length) lines.push(`${field.field}: ${entries.join(', ')}`);
        if (!remaining || usedChars >= MAX_PROMPT_CHARS) break;
    }
    return lines.length ? lines.join('\n') : undefined;
}
