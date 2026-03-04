import { useFetch } from '@vertesia/ui/core';
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
    related_tools?: string[];
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

    const { data: skill, isLoading, error } = useFetch<SkillDefinitionResponse>(
        () => fetch(`${baseUrl}/skills/${collection}/${name}`).then(r => {
            if (!r.ok) throw new Error(`Failed to load skill: ${r.statusText}`);
            return r.json();
        }),
        [baseUrl, collection, name]
    );

    if (isLoading) return <div className="vta-loading">Loading skill...</div>;
    if (error || !skill) return <div className="vta-error">Failed to load skill &ldquo;{name}&rdquo;.</div>;

    return (
        <DetailPage
            type="skill"
            title={skill.title || skill.name}
            description={skill.description}
            backHref={`/skills/${collection}`}
        >
            {/* Widgets */}
            {skill.widgets && skill.widgets.length > 0 && (
                <div className="vta-detail-section">
                    <h2>Widgets</h2>
                    <div className="vta-detail-flags">
                        {skill.widgets.map(w => (
                            <span key={w} className="vta-detail-flag">{w}</span>
                        ))}
                    </div>
                </div>
            )}

            {/* Scripts */}
            {skill.scripts && skill.scripts.length > 0 && (
                <div className="vta-detail-section">
                    <h2>Scripts</h2>
                    <div className="vta-detail-flags">
                        {skill.scripts.map(s => (
                            <span key={s} className="vta-detail-flag">{s}</span>
                        ))}
                    </div>
                </div>
            )}

            {/* Related tools */}
            {skill.related_tools && skill.related_tools.length > 0 && (
                <div className="vta-detail-section">
                    <h2>Related Tools</h2>
                    <div className="vta-detail-flags">
                        {skill.related_tools.map(t => (
                            <span key={t} className="vta-detail-flag">{t}</span>
                        ))}
                    </div>
                </div>
            )}

            {/* Execution environment */}
            {skill.execution && (
                <div className="vta-detail-section">
                    <h2>Execution</h2>
                    <div className="vta-detail-flags">
                        <span className="vta-detail-flag">{skill.execution.language}</span>
                        {skill.execution.packages?.map(p => (
                            <span key={p} className="vta-detail-flag">{p}</span>
                        ))}
                    </div>
                </div>
            )}

            {/* Instructions */}
            <div className="vta-detail-section">
                <h2>Instructions {skill.content_type === 'jst' && <span className="vta-tag">JST template</span>}</h2>
                <pre className="vta-detail-code">{skill.instructions}</pre>
            </div>

            {/* Input schema */}
            {skill.input_schema && (
                <div className="vta-detail-section">
                    <h2>Input Schema</h2>
                    <pre className="vta-detail-code">
                        {JSON.stringify(skill.input_schema, null, 2)}
                    </pre>
                </div>
            )}
        </DetailPage>
    );
}
