import { Badge, Card, CardContent, Spinner, useFetch } from '@vertesia/ui/core';
import { NavLink, useParams } from '@vertesia/ui/router';
import { useMemo } from 'react';

import { useAdminContext } from '../AdminContext.js';
import { DetailPage } from '../components/DetailPage.js';
import { TYPE_VARIANTS } from '../components/typeVariants.js';

interface SkillToolDef {
    name: string;
    description?: string;
    tools?: string[];
}

interface SkillCollectionResponse {
    title: string;
    description: string;
    tools: SkillToolDef[];
}

interface WidgetInfo {
    skill: string;
    collection: string;
    url: string;
}

interface WidgetsResponse {
    widgets: Record<string, WidgetInfo>;
}

/** Strip the learn_ prefix added by the SDK when exposing skills as tools. */
function skillDisplayName(name: string): string {
    return name.startsWith('learn_') ? name.slice(6) : name;
}

export function SkillCollection() {
    const collection = useParams('collection');
    const { baseUrl } = useAdminContext();

    const { data, error } = useFetch<SkillCollectionResponse>(
        () => fetch(`${baseUrl}/skills/${collection}`).then(r => {
            if (!r.ok) throw new Error(`Failed to load collection: ${r.statusText}`);
            return r.json();
        }),
        [baseUrl, collection]
    );

    const { data: widgetsData } = useFetch<WidgetsResponse>(
        () => fetch(`${baseUrl}/package?scope=widgets`).then(r => r.ok ? r.json() : { widgets: {} }),
        [baseUrl]
    );

    const collectionWidgets = useMemo(() => {
        if (!widgetsData?.widgets) return [];
        return Object.entries(widgetsData.widgets)
            .filter(([_, w]) => w.collection === collection)
            .map(([name, w]) => ({ name, ...w }));
    }, [widgetsData, collection]);

    if (error) return <div className="p-6 text-destructive">Failed to load skill collection &ldquo;{collection}&rdquo;.</div>;
    if (!data) return <div className="flex h-64 items-center justify-center text-muted-foreground"><Spinner /></div>;

    return (
        <DetailPage
            type="skill"
            title={data.title || collection}
            description={data.description || `${data.tools.length} skill${data.tools.length !== 1 ? 's' : ''} in this collection.`}
        >
            {collectionWidgets.length > 0 && (
                <div className="mb-8">
                    <h2 className="mb-3 text-lg font-semibold text-foreground">Widgets</h2>
                    <div className="flex flex-wrap gap-2">
                        {collectionWidgets.map(w => (
                            <Badge key={w.name} variant="success">
                                {w.name}
                                <span className="ml-2 font-mono text-xs opacity-70">(skill: {w.skill})</span>
                            </Badge>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {data.tools.map(skill => {
                    const displayName = skillDisplayName(skill.name);
                    return (
                        <NavLink key={skill.name} href={`/skills/${collection}/${displayName}`} className="block no-underline">
                            <Card className="cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md">
                                <CardContent className="p-5">
                                    <span className={`mb-2 inline-block rounded-full px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide ${TYPE_VARIANTS.skill}`}>
                                        skill
                                    </span>
                                    <div className="font-semibold text-card-foreground">{displayName}</div>
                                    <div className="mt-1 text-sm text-muted-foreground">{skill.description || 'No description'}</div>
                                    {skill.tools && skill.tools.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-1">
                                            {skill.tools.map(t => <Badge key={t}>{t}</Badge>)}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </NavLink>
                    );
                })}
            </div>
        </DetailPage>
    );
}
