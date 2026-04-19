import { Badge, Spinner, useFetch } from '@vertesia/ui/core';
import { useParams } from '@vertesia/ui/router';

import { useAdminContext } from '../AdminContext.js';
import { DetailPage } from '../components/DetailPage.js';

interface SkillDefinitionResponse {
    name: string;
    title?: string;
    description: string;
    instructions: string;
    content_type: 'md' | 'jst';
    input_schema?: Record<string, unknown>;
    tools?: string[];
    execution?: {
        language: string;
        packages?: string[];
    };
    scripts?: string[];
    widgets?: string[];
}

export function SkillDetail() {
    const params = useParams();
    const collection = params.collection;
    const name = params.name;
    const { baseUrl } = useAdminContext();

    const { data: skill, error } = useFetch<SkillDefinitionResponse>(
        () => fetch(`${baseUrl}/skills/${collection}/${name}`).then(r => {
            if (!r.ok) throw new Error(`Failed to load skill: ${r.statusText}`);
            return r.json();
        }),
        [baseUrl, collection, name]
    );

    if (error) return <div className="p-6 text-destructive">Failed to load skill &ldquo;{name}&rdquo;.</div>;
    if (!skill) return <div className="flex h-64 items-center justify-center text-muted-foreground"><Spinner /></div>;

    return (
        <DetailPage
            type="skill"
            title={skill.title || skill.name}
            description={skill.description}
            backHref={`/skills/${collection}`}
        >
            {skill.widgets && skill.widgets.length > 0 && (
                <div className="mb-8">
                    <h2 className="mb-3 text-lg font-semibold text-foreground">Widgets</h2>
                    <div className="flex flex-wrap gap-2">
                        {skill.widgets.map(w => <Badge key={w} variant="success">{w}</Badge>)}
                    </div>
                </div>
            )}

            {skill.scripts && skill.scripts.length > 0 && (
                <div className="mb-8">
                    <h2 className="mb-3 text-lg font-semibold text-foreground">Scripts</h2>
                    <div className="flex flex-wrap gap-2">
                        {skill.scripts.map(s => <Badge key={s} variant="success">{s}</Badge>)}
                    </div>
                </div>
            )}

            {skill.tools && skill.tools.length > 0 && (
                <div className="mb-8">
                    <h2 className="mb-3 text-lg font-semibold text-foreground">Related Tools</h2>
                    <div className="flex flex-wrap gap-2">
                        {skill.tools.map(t => <Badge key={t} variant="success">{t}</Badge>)}
                    </div>
                </div>
            )}

            {skill.execution && (
                <div className="mb-8">
                    <h2 className="mb-3 text-lg font-semibold text-foreground">Execution</h2>
                    <div className="flex flex-wrap gap-2">
                        <Badge variant="success">{skill.execution.language}</Badge>
                        {skill.execution.packages?.map(p => <Badge key={p} variant="success">{p}</Badge>)}
                    </div>
                </div>
            )}

            <div className="mb-8">
                <h2 className="mb-3 text-lg font-semibold text-foreground">
                    Instructions
                    {skill.content_type === 'jst' && <Badge className="ml-2">JST template</Badge>}
                </h2>
                <pre className="whitespace-pre-wrap wrap-break-word rounded-lg border border-border bg-muted-background p-4 font-mono text-sm text-foreground">{skill.instructions}</pre>
            </div>

            {skill.input_schema && (
                <div className="mb-8">
                    <h2 className="mb-3 text-lg font-semibold text-foreground">Input Schema</h2>
                    <pre className="whitespace-pre-wrap wrap-break-word rounded-lg border border-border bg-muted-background p-4 font-mono text-sm text-foreground">
                        {JSON.stringify(skill.input_schema, null, 2)}
                    </pre>
                </div>
            )}
        </DetailPage>
    );
}
