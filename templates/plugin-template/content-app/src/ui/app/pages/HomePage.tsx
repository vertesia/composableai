import { Button } from '@vertesia/ui/core';
import { useNavigate } from '@vertesia/ui/router';
import { BookOpen, CheckSquare, GitBranch, Lightbulb } from 'lucide-react';

const cards = [
    {
        title: 'Library',
        description: 'Browse app-owned guide records backed by the Store.',
        to: '/library',
        icon: BookOpen,
    },
    {
        title: 'Review Queue',
        description: 'Inspect typed review tasks linked to guides.',
        to: '/reviews',
        icon: CheckSquare,
    },
    {
        title: 'Process',
        description: 'Start the packaged guide review process.',
        to: '/process',
        icon: GitBranch,
    },
];

export function HomePage() {
    const navigate = useNavigate();

    return (
        <main className="p-6 space-y-6">
            <section className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted">
                    <Lightbulb className="size-4" />
                    Content app preset
                </div>
                <h1 className="text-2xl font-semibold">Field Guide Library</h1>
                <p className="max-w-3xl text-muted">
                    A service app scaffold with packaged content types, interactions, review process, and real Store
                    object screens.
                </p>
            </section>

            <section className="grid gap-3 md:grid-cols-3">
                {cards.map((card) => {
                    const Icon = card.icon;
                    return (
                        <article key={card.to} className="rounded-md border border-border bg-card p-4">
                            <div className="mb-3 flex items-center gap-2">
                                <Icon className="size-4 text-info" />
                                <h2 className="text-base font-semibold">{card.title}</h2>
                            </div>
                            <p className="min-h-12 text-sm text-muted">{card.description}</p>
                            <Button className="mt-4" variant="outline" size="sm" onClick={() => navigate(card.to)}>
                                Open
                            </Button>
                        </article>
                    );
                })}
            </section>
        </main>
    );
}
