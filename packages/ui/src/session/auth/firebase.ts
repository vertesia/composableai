import { UIResolvedTenant } from "@vertesia/common";
import { Env } from "@vertesia/ui/env";
import { Analytics, getAnalytics } from "firebase/analytics";
import { FirebaseApp, initializeApp } from "firebase/app";
import { Auth, getAuth } from "firebase/auth";

// Use lazy initialization to avoid accessing Env before it's initialized
let _firebaseApp: FirebaseApp | null = null;
let _analytics: Analytics | null = null;
let _firebaseAuth: Auth | null = null;

// Getters that lazily initialize Firebase components when first accessed
export function getFirebaseApp(): FirebaseApp {
    if (!_firebaseApp) {
        try {
            _firebaseApp = initializeApp(Env.firebase);
        } catch (error) {
            console.error("Failed to initialize Firebase app:", error);
            throw new Error("Firebase initialization failed - environment may not be properly initialized");
        }
    }
    return _firebaseApp;
}

export function getFirebaseAnalytics(): Analytics {
    if (!_analytics) {
        _analytics = getAnalytics(getFirebaseApp());
    }
    return _analytics;
}

export function getFirebaseAuth(): Auth {
    if (!_firebaseAuth) {
        _firebaseAuth = getAuth(getFirebaseApp());
    }
    return _firebaseAuth;
}


export async function setFirebaseTenant(tenantEmail?: string) {
    if (!tenantEmail) {
        console.log("No tenant name or email specified, skipping tenant setup");
        return;
    }

    try {
        if (tenantEmail) console.log(`Resolving tenant ID from email: ${tenantEmail}`);

        // Add retry logic with exponential backoff
        let retries = 3;
        let retryDelay = 250; // Start with 250ms delay

        while (retries > 0) {
            try {
                // Call the API endpoint to resolve the tenant ID
                const response = await fetch("/api/resolve-tenant", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        tenantEmail: tenantEmail,
                    }),
                    // Add timeout to prevent hanging requests
                    signal: AbortSignal.timeout(5000),
                });

                // Check for network errors
                if (!response) {
                    throw new Error("No response received from tenant API");
                }

                // Handle HTTP error responses
                if (!response.ok) {
                    // Try to parse the error response
                    try {
                        const errorData = await response.json();
                        console.error("Failed to resolve tenant ID:", errorData.error);
                    } catch (parseError) {
                        console.error(`Failed to resolve tenant ID: HTTP ${response.status}`);
                    }

                    // If the error is 404 Not Found, no need to retry
                    if (response.status === 404) {
                        console.warn(`Tenant not found for ${tenantEmail}`);
                        return;
                    }

                    throw new Error(`HTTP error ${response.status}`);
                }

                // Successfully got a response, parse it
                const data = (await response.json()) as UIResolvedTenant;

                if (data && data.firebaseTenantId) {
                    const auth = getFirebaseAuth();
                    auth.tenantId = data.firebaseTenantId;
                    Env.firebase.providerType = data.provider ?? "oidc";
                    console.log(`Tenant ID set to ${auth.tenantId}`);
                    return data;
                } else {
                    console.error(`Invalid response format, missing tenantId for ${tenantEmail}`);
                    return; // No need to retry for invalid response format
                }
            } catch (fetchError) {
                // Only retry for network-related errors
                if (retries > 1) {
                    console.warn(`Tenant resolution failed, retrying in ${retryDelay}ms...`, fetchError);
                    await new Promise((resolve) => setTimeout(resolve, retryDelay));
                    retryDelay *= 2; // Exponential backoff
                    retries--;
                } else {
                    throw fetchError; // Last retry failed, propagate error
                }
            }
        }
    } catch (error) {
        // Final error handler
        console.error("Error setting Firebase tenant:", error instanceof Error ? error.message : "Unknown error");

        // Continue without tenant ID - authentication will work without multi-tenancy
        // but the user will access the default tenant
    }
}

export async function getFirebaseAuthToken(refresh?: boolean) {
    const auth = getFirebaseAuth();
    const user = auth.currentUser;
    if (user) {
        return user
            .getIdToken(refresh)
            .then((token) => {
                Env.logger.info("Got Firebase token", {
                    vertesia: {
                        user_email: user.email,
                        user_name: user.displayName,
                        user_id: user.uid,
                        refresh: refresh,
                    },
                });
                return token;
            })
            .catch((err) => {
                Env.logger.error("Failed to get Firebase token", {
                    vertesia: {
                        user_email: user.email,
                        user_name: user.displayName,
                        user_id: user.uid,
                        refresh: refresh,
                        error: err,
                    },
                });
                console.error("Failed to get access token", err);
                return null;
            });
    } else {
        Env.logger.warn("No user found");
        return Promise.resolve(null);
    }
}
