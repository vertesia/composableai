import { Button, Input, Textarea } from '@vertesia/ui/core';
import { useUserSession } from '@vertesia/ui/session';
import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import { FIELD_SUGGESTER_INTERACTION } from '../constants';
import type { FieldSuggestionResult } from './content-types';

export function IdeasPage() {
    const { client } = useUserSession();
    const [interest, setInterest] = useState('quiet alpine routes');
    const [region, setRegion] = useState('Pacific Northwest');
    const [season, setSeason] = useState('late summer');
    const [constraints, setConstraints] = useState('family-friendly, low permit friction');
    const [result, setResult] = useState<FieldSuggestionResult | undefined>();
    const [isRunning, setIsRunning] = useState(false);
    const [error, setError] = useState<string | undefined>();

    const runInteraction = async () => {
        setIsRunning(true);
        setError(undefined);
        try {
            const response = await client.interactions.executeByName<FieldSuggestionResult>(
                FIELD_SUGGESTER_INTERACTION,
                {
                    data: { interest, region, season, constraints },
                },
            );
            setResult(response.result.object<FieldSuggestionResult>());
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <main className="min-h-0 overflow-auto p-6">
            <section className="grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
                <div className="space-y-4">
                    <div>
                        <h1 className="text-xl font-semibold">Topic Ideas</h1>
                        <p className="text-sm text-muted">Runs the packaged field suggester interaction.</p>
                    </div>
                    <div className="space-y-3 rounded-md border border-border bg-card p-4">
                        <div className="block text-sm">
                            <span className="mb-1 block font-medium">Interest</span>
                            <Input value={interest} onChange={setInterest} aria-label="Interest" />
                        </div>
                        <div className="block text-sm">
                            <span className="mb-1 block font-medium">Region</span>
                            <Input value={region} onChange={setRegion} aria-label="Region" />
                        </div>
                        <div className="block text-sm">
                            <span className="mb-1 block font-medium">Season</span>
                            <Input value={season} onChange={setSeason} aria-label="Season" />
                        </div>
                        <div className="block text-sm">
                            <label htmlFor="idea-constraints" className="mb-1 block font-medium">
                                Constraints
                            </label>
                            <Textarea
                                id="idea-constraints"
                                value={constraints}
                                onChange={(event) => setConstraints(event.target.value)}
                                rows={3}
                            />
                        </div>
                        <Button onClick={() => void runInteraction()} disabled={isRunning}>
                            <Sparkles className="me-2 size-4" />
                            Generate ideas
                        </Button>
                    </div>
                </div>

                <div className="rounded-md border border-border bg-card p-4">
                    <h2 className="text-sm font-semibold">Suggestions</h2>
                    {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
                    {result ? (
                        <div className="mt-4 grid gap-3">
                            {result.suggestions.map((suggestion) => (
                                <article key={suggestion.title} className="rounded-md border border-border p-3">
                                    <h3 className="font-medium">{suggestion.title}</h3>
                                    <p className="mt-1 text-sm text-muted">{suggestion.rationale}</p>
                                    <div className="mt-2 flex flex-wrap gap-1">
                                        {suggestion.tags.map((tag) => (
                                            <span
                                                key={tag}
                                                className="rounded border border-border px-2 py-0.5 text-xs"
                                            >
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </article>
                            ))}
                        </div>
                    ) : (
                        <p className="mt-3 text-sm text-muted">No suggestions yet.</p>
                    )}
                </div>
            </section>
        </main>
    );
}
