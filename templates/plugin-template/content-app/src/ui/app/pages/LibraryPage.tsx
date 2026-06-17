import { Button, Input, Spinner } from '@vertesia/ui/core';
import { useNavigate } from '@vertesia/ui/router';
import { useUserSession } from '@vertesia/ui/session';
import { RefreshCw, Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { GUIDE_TYPE, SEED_MARKER } from '../constants';
import { type GuideObject, statusClass } from './content-types';

export function LibraryPage() {
    const { client } = useUserSession();
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [guides, setGuides] = useState<GuideObject[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | undefined>();

    const loadGuides = useCallback(async () => {
        setIsLoading(true);
        setError(undefined);
        try {
            const response = await client.objects.search({
                query: {
                    type: GUIDE_TYPE,
                    full_text: query.trim() || undefined,
                    match: { 'properties.seed_marker': SEED_MARKER },
                },
                limit: 50,
            });
            setGuides(response.results as unknown as GuideObject[]);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsLoading(false);
        }
    }, [client, query]);

    useEffect(() => {
        void loadGuides();
    }, [loadGuides]);

    return (
        <main className="flex h-full flex-col">
            <header className="border-b border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-semibold">Guide Library</h1>
                        <p className="text-sm text-muted">Store objects typed as {GUIDE_TYPE}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => void loadGuides()}>
                        <RefreshCw className="me-2 size-4" />
                        Refresh
                    </Button>
                </div>
                <div className="mt-4 flex max-w-xl items-center gap-2">
                    <Search className="size-4 text-muted" />
                    <Input
                        value={query}
                        onChange={setQuery}
                        placeholder="Search guides..."
                        aria-label="Search guides"
                    />
                </div>
            </header>

            <section className="min-h-0 flex-1 overflow-auto p-4">
                {error && (
                    <div className="rounded-md border border-destructive p-3 text-sm text-destructive">{error}</div>
                )}
                {isLoading ? (
                    <div className="flex h-40 items-center justify-center">
                        <Spinner />
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-md border border-border">
                        <table className="w-full table-fixed text-left text-sm">
                            <thead className="bg-muted/30 text-xs uppercase text-muted">
                                <tr>
                                    <th className="w-[32%] px-3 py-2 font-medium">Title</th>
                                    <th className="w-[18%] px-3 py-2 font-medium">Status</th>
                                    <th className="w-[18%] px-3 py-2 font-medium">Category</th>
                                    <th className="w-[16%] px-3 py-2 font-medium">Owner</th>
                                    <th className="w-[16%] px-3 py-2 font-medium">Location</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {guides.map((guide) => (
                                    <tr
                                        key={guide.id}
                                        className="cursor-pointer hover:bg-muted/20"
                                        onClick={() => navigate(`/library/${guide.id}`)}
                                    >
                                        <td className="px-3 py-3">
                                            <div className="truncate font-medium">{guide.properties.title}</div>
                                            <div className="truncate text-xs text-muted">
                                                {guide.properties.summary}
                                            </div>
                                        </td>
                                        <td className="px-3 py-3">
                                            <span
                                                className={`inline-flex rounded border px-2 py-0.5 text-xs ${statusClass(
                                                    guide.properties.status,
                                                )}`}
                                            >
                                                {guide.properties.status}
                                            </span>
                                        </td>
                                        <td className="truncate px-3 py-3">{guide.properties.category}</td>
                                        <td className="truncate px-3 py-3">{guide.properties.owner}</td>
                                        <td className="truncate px-3 py-3">{guide.properties.location_slug}</td>
                                    </tr>
                                ))}
                                {guides.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-3 py-8 text-center text-muted">
                                            No guides found. Run the content app setup script from the project
                                            workspace.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </main>
    );
}
