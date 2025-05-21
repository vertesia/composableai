import { Env } from '@vertesia/ui/env';
import { AuthTokenPayload } from '@vertesia/common';
import { logEvent } from "firebase/analytics";
import { analytics } from "./auth/firebase";

export function useUXTracking() {

    //identify user in monitoring and UX systems
    const tagUserSession = async (user?: AuthTokenPayload) => {
        const signupData = window.localStorage.getItem("composableSignupData");
        if (!user) {
            console.error('No user found -- skipping tagging');
            return;
        }

        if (signupData) {
            window.localStorage.removeItem("composableSignupData");
        }
    }

    //send event to analytics and UX systems
    const trackEvent = (eventName: string, eventProperties?: any) => {

        if (!Env.isProd) {
            console.debug('track event', eventName, eventProperties);
        }

        //GA via firebase
        logEvent(analytics, eventName, { ...eventProperties, debug_mode: !Env.isProd });

    }

    return {
        tagUserSession,
        trackEvent
    }

}