import { useFetch } from '@vertesia/ui/core';
import { useParams } from '@vertesia/ui/router';
import type { InteractionSpec } from '@vertesia/common';
import { useAdminContext } from '../AdminContext.js';
import { DetailPage } from '../components/DetailPage.js';
import { useUserSession } from '@vertesia/ui/session';

type InteractionResponse = InteractionSpec & { id: string };

export function InteractionDetail() {
    const { client } = useUserSession();
    const params = useParams();
    const collection = params.collection;
    const name = params.name;
    const { baseUrl } = useAdminContext();

    const { data: interaction, isLoading, error } = useFetch<InteractionResponse>(
        () => client.getRawJWT().then(token => fetch(`${baseUrl}/interactions/${collection}/${name}`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        })).then(r => {
            if (!r.ok) throw new Error(`Failed to load interaction: ${r.statusText}`);
            return r.json();
        }),
        [baseUrl, collection, name]
    );

    if (isLoading) {
        return <div className="vta-loading">Loading interaction...</div>;
    }

    if (error || !interaction) {
        return <div className="vta-error">Failed to load interaction &ldquo;{name}&rdquo;.</div>;
    }

    const { agent_runner_options } = interaction;
    const hasAgentFlags = agent_runner_options &&
        (agent_runner_options.is_agent || agent_runner_options.is_tool || agent_runner_options.is_skill);

    return (
        <DetailPage
            type="interaction"
            title={interaction.title || interaction.name}
            description={interaction.description}
            tags={interaction.tags}
            backHref={`/interactions/${collection}`}
        >
            {/* Prompts */}
            {interaction.prompts && interaction.prompts.length > 0 && (
                <div className="vta-detail-section">
                    <h2>Prompts</h2>
                    {interaction.prompts.map((prompt, i) => (
                        <div key={i} className="vta-detail-card">
                            <div className="vta-detail-card-header">
                                <span className={`vta-detail-role vta-detail-role--${prompt.role}`}>
                                    {prompt.role}
                                </span>
                                {prompt.name && (
                                    <span className="vta-detail-prompt-name">{prompt.name}</span>
                                )}
                            </div>
                            <pre className="vta-detail-code">{prompt.content}</pre>
                        </div>
                    ))}
                </div>
            )}

            {/* Result schema */}
            {interaction.result_schema && (
                <div className="vta-detail-section">
                    <h2>Result Schema</h2>
                    <pre className="vta-detail-code">
                        {JSON.stringify(interaction.result_schema, null, 2)}
                    </pre>
                </div>
            )}

            {/* Agent runner options */}
            {hasAgentFlags && (
                <div className="vta-detail-section">
                    <h2>Agent Runner</h2>
                    <div className="vta-detail-flags">
                        {agent_runner_options.is_agent && <span className="vta-detail-flag">Agent</span>}
                        {agent_runner_options.is_tool && <span className="vta-detail-flag">Tool</span>}
                        {agent_runner_options.is_skill && <span className="vta-detail-flag">Skill</span>}
                    </div>
                </div>
            )}
        </DetailPage>
    );
}
