import { describe, expect, it } from 'vitest';
import { createHomePageState } from './HomePage.state';

describe('createHomePageState', () => {
    it('returns the configured app name and scaffold guidance used by HomePage', () => {
        const state = createHomePageState('Example App');

        expect(state).toEqual({
            appName: 'Example App',
            guidance: 'Build UI in src/modules/app/ui and resources in src/modules/app/resources.',
        });
    });
});
