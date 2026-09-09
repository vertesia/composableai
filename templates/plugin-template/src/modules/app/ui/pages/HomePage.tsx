import { Env } from '@vertesia/ui/env';
import { createHomePageState } from './HomePage.state';

export function HomePage() {
    const state = createHomePageState(Env.name);

    return (
        <div className="p-6 space-y-4">
            <h1 className="text-2xl font-semibold">{state.appName}</h1>
            <p className="text-muted">{state.guidance}</p>
        </div>
    );
}
