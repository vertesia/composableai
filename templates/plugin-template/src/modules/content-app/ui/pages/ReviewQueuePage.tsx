import { Button, Spinner } from '@vertesia/ui/core';
import { useUserSession } from '@vertesia/ui/session';
import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { REVIEW_TASK_TYPE, SEED_MARKER } from '../constants';
import { priorityClass, type ReviewTaskObject, statusClass } from './content-types';

export function ReviewQueuePage() {
    const { client } = useUserSession();
    const [tasks, setTasks] = useState<ReviewTaskObject[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | undefined>();

    const loadTasks = useCallback(async () => {
        setIsLoading(true);
        setError(undefined);
        try {
            const response = await client.objects.search({
                query: {
                    type: REVIEW_TASK_TYPE,
                    match: { 'properties.seed_marker': SEED_MARKER },
                },
                limit: 50,
            });
            setTasks(response.results as unknown as ReviewTaskObject[]);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsLoading(false);
        }
    }, [client]);

    useEffect(() => {
        void loadTasks();
    }, [loadTasks]);

    return (
        <main className="flex h-full flex-col">
            <header className="border-b border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-semibold">Review Queue</h1>
                        <p className="text-sm text-muted">Typed review task objects linked to guides.</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => void loadTasks()}>
                        <RefreshCw className="me-2 size-4" />
                        Refresh
                    </Button>
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
                    <div className="grid gap-3">
                        {tasks.map((task) => (
                            <article key={task.id} className="rounded-md border border-border bg-card p-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <h2 className="font-semibold">{task.properties.title}</h2>
                                        <p className="text-sm text-muted">Guide: {task.properties.guide_slug}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <span
                                            className={`rounded border px-2 py-0.5 text-xs ${priorityClass(
                                                task.properties.priority,
                                            )}`}
                                        >
                                            {task.properties.priority}
                                        </span>
                                        <span
                                            className={`rounded border px-2 py-0.5 text-xs ${statusClass(
                                                task.properties.status,
                                            )}`}
                                        >
                                            {task.properties.status}
                                        </span>
                                    </div>
                                </div>
                                <div className="mt-3 grid gap-3 md:grid-cols-[220px_1fr]">
                                    <dl className="grid grid-cols-[80px_1fr] gap-2 text-sm">
                                        <dt className="text-muted">Owner</dt>
                                        <dd>{task.properties.assignee}</dd>
                                        <dt className="text-muted">Due</dt>
                                        <dd>{task.properties.due_date}</dd>
                                    </dl>
                                    <ul className="list-disc space-y-1 ps-5 text-sm">
                                        {task.properties.checklist.map((item) => (
                                            <li key={item}>{item}</li>
                                        ))}
                                    </ul>
                                </div>
                            </article>
                        ))}
                        {tasks.length === 0 && (
                            <div className="rounded-md border border-border p-8 text-center text-muted">
                                No review tasks found. Run the content app setup script from the project workspace.
                            </div>
                        )}
                    </div>
                )}
            </section>
        </main>
    );
}
