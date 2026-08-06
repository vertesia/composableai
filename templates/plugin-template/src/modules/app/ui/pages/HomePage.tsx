import { Env } from '@vertesia/ui/env';

export function HomePage() {
    return (
        <div className="p-6 space-y-4">
            <h1 className="text-2xl font-semibold">{Env.name}</h1>
            <p className="text-muted">Build UI in src/modules/app/ui and resources in src/modules/app/resources.</p>
        </div>
    );
}
