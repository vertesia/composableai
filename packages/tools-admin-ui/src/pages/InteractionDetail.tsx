import type { InteractionSpec } from '@vertesia/common';
import { Badge, Card, CardContent, Spinner, useFetch } from '@vertesia/ui/core';
import { useParams } from '@vertesia/ui/router';
import { useUserSession } from '@vertesia/ui/session';

import { useAdminContext } from '../AdminContext.js';
import { DetailPage } from '../components/DetailPage.js';
import { ROLE_VARIANTS } from '../components/typeVariants.js';

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
        return <div className="flex h-64 items-center justify-center text-muted-foreground"><Spinner /></div>;
    }

    if (error || !interaction) {
        return <div className="p-6 text-destructive">Failed to load interaction &ldquo;{name}&rdquo;.</div>;
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
            {interaction.prompts && interaction.prompts.length > 0 && (
                <div className="mb-8">
                    <h2 className="mb-3 text-lg font-semibold text-foreground">Prompts</h2>
                    {interaction.prompts.map((prompt) => (
                        <Card key={`${prompt.role}-${prompt.name ?? ''}`} className="mb-3">
                            <CardContent className="p-4">
                                <div className="mb-2 flex items-center gap-2">
                                    <span className={`rounded-full px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide ${ROLE_VARIANTS[prompt.role] ?? ''}`}>
                                        {prompt.role}
                                    </span>
                                    {prompt.name && (
                                        <span className="text-sm italic text-muted-foreground">{prompt.name}</span>
                                    )}
                                </div>
                                <pre className="whitespace-pre-wrap wrap-break-word rounded-lg border border-border bg-muted-background p-4 font-mono text-sm text-foreground">{prompt.content}</pre>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {interaction.result_schema && (
                <div className="mb-8">
                    <h2 className="mb-3 text-lg font-semibold text-foreground">Result Schema</h2>
                    <pre className="whitespace-pre-wrap wrap-break-word rounded-lg border border-border bg-muted-background p-4 font-mono text-sm text-foreground">
                        {JSON.stringify(interaction.result_schema, null, 2)}
                    </pre>
                </div>
            )}

            {hasAgentFlags && (
                <div className="mb-8">
                    <h2 className="mb-3 text-lg font-semibold text-foreground">Agent Runner</h2>
                    <div className="flex flex-wrap gap-2">
                        {agent_runner_options.is_agent && <Badge variant="success">Agent</Badge>}
                        {agent_runner_options.is_tool && <Badge variant="success">Tool</Badge>}
                        {agent_runner_options.is_skill && <Badge variant="success">Skill</Badge>}
                    </div>
                </div>
            )}
        </DetailPage>
    );
}
