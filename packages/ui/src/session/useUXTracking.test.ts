import { logEvent } from 'firebase/analytics';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getFirebaseAnalytics } from './auth/firebase';
import { useUXTracking } from './useUXTracking';

vi.mock('@vertesia/ui/env', () => ({
    Env: { isProd: true, firebase: { apiKey: 'test-api-key' } },
}));
vi.mock('firebase/analytics', () => ({ logEvent: vi.fn() }));
vi.mock('./auth/firebase', () => ({ getFirebaseAnalytics: vi.fn(() => ({})) }));

describe('useUXTracking.trackEvent', () => {
    beforeEach(() => vi.clearAllMocks());
    afterEach(() => vi.restoreAllMocks());

    it('logs the event when online', () => {
        vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
        useUXTracking().trackEvent('test_event', { key: 'value' });
        expect(logEvent).toHaveBeenCalledWith({}, 'test_event', { key: 'value', debug_mode: false });
    });

    it('does not initialize Analytics while offline', () => {
        vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
        useUXTracking().trackEvent('test_event');
        expect(getFirebaseAnalytics).not.toHaveBeenCalled();
        expect(logEvent).not.toHaveBeenCalled();
    });
});
