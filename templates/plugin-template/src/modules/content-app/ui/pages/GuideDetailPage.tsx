import { Button, Spinner } from '@vertesia/ui/core';
import { useNavigate, useParams } from '@vertesia/ui/router';
import { useUserSession } from '@vertesia/ui/session';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { GUIDE_SUMMARIZER_INTERACTION } from '../constants';
import { type GuideObject, type GuideSummaryResult, statusClass } from './content-types';

export function GuideDetailPage() {
    const { client } = useUserSession();
    const navigate = useNavigate();
    const params = useParams() as { id?: string };
    const [guide, setGuide] = useState<GuideObject | undefined>();
    const [summary, setSummary] = useState<GuideSummaryResult | undefined>();
    const [isLoading, setIsLoading] = useState(true);
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [error, setError] = useState<string | undefined>();

    const loadGuide = useCallback(async () => {
        if (!params.id) return;
        setIsLoading(true);
        setError(undefined);
        try {
            setGuide((await client.objects.retrieve(params.id)) as unknown as GuideObject);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsLoading(false);
        }
    }, [client, params.id]);

    useEffect(() => {
        void loadGuide();
    }, [loadGuide]);

    const summarize = async () => {
        if (!guide) return;
        setIsSummarizing(true);
        setError(undefined);
        try {
            const result = await client.interactions.executeByName<GuideSummaryResult>(GUIDE_SUMMARIZER_INTERACTION, {
                data: {
                    guide_title: guide.properties.title,
                    body: guide.properties.body,
                    location: guide.properties.location_slug,
                    audience: guide.properties.audience,
                },
            });
            setSummary(result.result.object<GuideSummaryResult>());
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsSummarizing(false);
        }
    };

    if (isLoading) {
        return (
            <main className="flex h-full items-center justify-center">
                <Spinner />
            </main>
        );
    }

    if (!guide) {
        return <main className="p-6 text-destructive">{error ?? 'Guide not found.'}</main>;
    }

    return (
        <main className="min-h-0 overflow-auto p-6">
            <Button variant="ghost" size="sm" onClick={() => navigate('/content/library')}>
                <ArrowLeft className="me-2 size-4" />
                Library
            </Button>

            <section className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
                <article className="space-y-4">
                    <div>
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                            <span
                                className={`inline-flex rounded border px-2 py-0.5 text-xs ${statusClass(
                                    guide.properties.status,
                                )}`}
                            >
                                {guide.properties.status}
                            </span>
                            <span className="text-sm text-muted">{guide.properties.category}</span>
                        </div>
                        <h1 className="text-2xl font-semibold">{guide.properties.title}</h1>
                        <p className="mt-2 text-muted">{guide.properties.summary}</p>
                    </div>
                    <div className="whitespace-pre-wrap rounded-md border border-border bg-card p-4 text-sm leading-6">
                        {guide.properties.body}
                    </div>
                </article>

                <aside className="space-y-4">
                    <div className="rounded-md border border-border bg-card p-4">
                        <h2 className="text-sm font-semibold">Metadata</h2>
                        <dl className="mt-3 grid grid-cols-[110px_1fr] gap-2 text-sm">
                            <dt className="text-muted">Owner</dt>
                            <dd>{guide.properties.owner}</dd>
                            <dt className="text-muted">Audience</dt>
                            <dd>{guide.properties.audience}</dd>
                            <dt className="text-muted">Location</dt>
                            <dd>{guide.properties.location_slug}</dd>
                            <dt className="text-muted">Slug</dt>
                            <dd>{guide.properties.slug}</dd>
                        </dl>
                    </div>
                    <div className="rounded-md border border-border bg-card p-4">
                        <div className="flex items-center justify-between gap-3">
                            <h2 className="text-sm font-semibold">AI Summary</h2>
                            <Button size="sm" onClick={() => void summarize()} disabled={isSummarizing}>
                                <Sparkles className="me-2 size-4" />
                                Run
                            </Button>
                        </div>
                        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
                        {summary ? (
                            <div className="mt-3 space-y-3 text-sm">
                                <p>{summary.summary}</p>
                                <ul className="list-disc space-y-1 ps-5">
                                    {summary.bullets.map((bullet) => (
                                        <li key={bullet}>{bullet}</li>
                                    ))}
                                </ul>
                                <p className="text-muted">Recommended: {summary.recommended_status}</p>
                            </div>
                        ) : (
                            <p className="mt-3 text-sm text-muted">Run the packaged guide summarizer interaction.</p>
                        )}
                    </div>
                </aside>
            </section>
        </main>
    );
}
