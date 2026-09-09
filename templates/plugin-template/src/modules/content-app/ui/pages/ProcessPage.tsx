import { Button, Spinner } from '@vertesia/ui/core';
import { useUserSession } from '@vertesia/ui/session';
import { GitBranch, Play } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { GUIDE_REVIEW_PROCESS, GUIDE_TYPE, SEED_MARKER } from '../constants';
import type { GuideObject } from './content-types';

export function ProcessPage() {
    const { client } = useUserSession();
    const [guides, setGuides] = useState<GuideObject[]>([]);
    const [selectedGuideId, setSelectedGuideId] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isStarting, setIsStarting] = useState(false);
    const [startedRunId, setStartedRunId] = useState<string | undefined>();
    const [error, setError] = useState<string | undefined>();

    const loadGuides = useCallback(async () => {
        setIsLoading(true);
        setError(undefined);
        try {
            const response = await client.objects.search({
                query: {
                    type: GUIDE_TYPE,
                    match: { 'properties.seed_marker': SEED_MARKER },
                },
                limit: 25,
            });
            const nextGuides = response.results as unknown as GuideObject[];
            setGuides(nextGuides);
            setSelectedGuideId((current) => current || nextGuides[0]?.id || '');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsLoading(false);
        }
    }, [client]);

    useEffect(() => {
        void loadGuides();
    }, [loadGuides]);

    const selectedGuide = guides.find((guide) => guide.id === selectedGuideId);

    const startProcess = async () => {
        if (!selectedGuide) return;
        setIsStarting(true);
        setError(undefined);
        try {
            const run = await client.agents.start({
                process_id: GUIDE_REVIEW_PROCESS,
                run_type: 'programmatic',
                data: {
                    guide_slug: selectedGuide.properties.slug,
                    guide_title: selectedGuide.properties.title,
                    guide_body: selectedGuide.properties.body,
                    location_slug: selectedGuide.properties.location_slug,
                    review_notes: '',
                },
                tags: [SEED_MARKER, 'content-app-process'],
            });
            setStartedRunId(run.id);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsStarting(false);
        }
    };

    return (
        <main className="p-6">
            <section className="max-w-3xl space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted">
                    <GitBranch className="size-4" />
                    Packaged process
                </div>
                <div>
                    <h1 className="text-xl font-semibold">Guide Review Process</h1>
                    <p className="text-sm text-muted">
                        Starts {GUIDE_REVIEW_PROCESS}, which runs two packaged interactions and then waits on a human
                        task.
                    </p>
                </div>

                <div className="rounded-md border border-border bg-card p-4">
                    {isLoading ? (
                        <div className="flex h-24 items-center justify-center">
                            <Spinner />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <label className="block text-sm">
                                <span className="mb-1 block font-medium">Guide</span>
                                <select
                                    className="w-full rounded-md border border-border bg-background px-3 py-2"
                                    value={selectedGuideId}
                                    onChange={(event) => setSelectedGuideId(event.target.value)}
                                >
                                    {guides.map((guide) => (
                                        <option key={guide.id} value={guide.id}>
                                            {guide.properties.title}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            {selectedGuide && <p className="text-sm text-muted">{selectedGuide.properties.summary}</p>}
                            <Button onClick={() => void startProcess()} disabled={!selectedGuide || isStarting}>
                                <Play className="me-2 size-4" />
                                Start review
                            </Button>
                        </div>
                    )}
                    {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
                    {startedRunId && (
                        <p className="mt-4 rounded-md border border-success p-3 text-sm text-success">
                            Process run started: {startedRunId}
                        </p>
                    )}
                </div>
            </section>
        </main>
    );
}
