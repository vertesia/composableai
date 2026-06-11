import type { AuthTokenPayload } from '@vertesia/common';
import { Env } from '@vertesia/ui/env';
import { logEvent } from 'firebase/analytics';
import { useCallback } from 'react';
import { getFirebaseAnalytics } from './auth/firebase';

export function useUXTracking() {
    //identify user in monitoring and UX systems
    const tagUserSession = useCallback(async (user?: AuthTokenPayload) => {
        const signupData = window.localStorage.getItem('composableSignupData');
        if (!user) {
            console.error('No user found -- skipping tagging');
            return;
        }

        if (signupData) {
            window.localStorage.removeItem('composableSignupData');
        }
    }, []);

    //send event to analytics and UX systems
    const trackEvent = useCallback((eventName: string, eventProperties?: Record<string, unknown>) => {
        //GA via firebase
        logEvent(getFirebaseAnalytics(), eventName, { ...eventProperties, debug_mode: !Env.isProd });
    }, []);

    return {
        tagUserSession,
        trackEvent,
    };
}
