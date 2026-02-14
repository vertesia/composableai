import { Env } from "@vertesia/ui/env";
import { onAuthStateChanged } from "firebase/auth";
import { ReactNode, useEffect, useRef, useState } from "react";
import { UserNotFoundError, getComposableToken } from "./auth/composable";
import { getFirebaseAuth } from "./auth/firebase";
import { useAuthState } from "./auth/useAuthState";
import { LastSelectedAccountId_KEY, LastSelectedProjectId_KEY, UserSession, UserSessionContext } from "./UserSession";

const devDomains = [".composable.sh", ".vertesia.dev", "vertesia.app"];
const CENTRAL_AUTH_REDIRECT = "https://internal-auth.vertesia.app/";

export function shouldRedirectToCentralAuth() {
    // Authentication is not supported in Docker environment.
    // See https://github.com/vertesia/studio/wiki/Composable-UI-Hosting-Options
    if (Env.isDocker) {
        return true;
    }
    return devDomains.some((domain) => window.location.hostname.endsWith(domain));
}

interface UserSessionProviderProps {
    children: ReactNode | ReactNode[];
}
export function UserSessionProvider({ children }: UserSessionProviderProps) {
    const hashParams = new URLSearchParams(location.hash.substring(1));
    const token = hashParams.get("token");
    const state = hashParams.get("state");
    const [session, setSession] = useState<UserSession>(new UserSession());
    const { generateState, verifyState, clearState } = useAuthState();
    const hasInitiatedAuthRef = useRef(false);

    const redirectToCentralAuth = (projectId?: string, accountId?: string) => {
        const url = new URL(`${CENTRAL_AUTH_REDIRECT}?sts=${Env.endpoints.sts ?? "https://sts.vertesia.io"}`);
        const currentUrl = new URL(window.location.href);
        currentUrl.hash = "";
        if (projectId) currentUrl.searchParams.set("p", projectId);
        if (accountId) currentUrl.searchParams.set("a", accountId);
        url.searchParams.set("redirect_uri", currentUrl.toString());
        url.searchParams.set("state", generateState());
        location.replace(url.toString());
    };

    useEffect(() => {
        // Make this effect idempotent - only run auth flow once
        if (hasInitiatedAuthRef.current) {
            console.log("Auth: skipping duplicate auth flow initiation");
            return;
        }
        hasInitiatedAuthRef.current = true;

        console.log("Auth: starting auth flow");
        Env.logger.info("Starting auth flow");
        const currentUrl = new URL(window.location.href);
        const selectedAccount =
            currentUrl.searchParams.get("a") ?? localStorage.getItem(LastSelectedAccountId_KEY) ?? undefined;
        const selectedProject =
            currentUrl.searchParams.get("p") ??
            localStorage.getItem(LastSelectedProjectId_KEY + "-" + selectedAccount) ??
            undefined;
        console.log("Auth: selected account", selectedAccount);
        console.log("Auth: selected project", selectedProject);
        Env.logger.info("Selected account and project", {
            vertesia: {
                account_id: selectedAccount,
                project_id: selectedProject,
            },
        });

        if (token && state) {
            const validationError = verifyState(state);
            if (validationError) {
                console.error(`Auth: invalid state: ${validationError}`);
                Env.logger.error(`Invalid state: ${validationError}`, {
                    vertesia: {
                        state: state,
                    },
                });
                redirectToCentralAuth();
            } else {
                clearState()
            }
            getComposableToken(selectedAccount, selectedProject, token, false, shouldRedirectToCentralAuth())
                .then((res) => {
                    session.login(res.rawToken).then(() => {
                        setSession(session.clone());
                        //cleanup the hash
                        window.location.hash = "";
                    });
                })
                .catch((err) => {
                    // Don't redirect to central auth for UserNotFoundError - let signup flow handle it
                    if (err instanceof UserNotFoundError) {
                        console.log("User not found - will trigger signup flow", err);
                        session.isLoading = false;
                        session.authError = err;
                        setSession(session.clone());
                        return;
                    }

                    console.error("Failed to fetch user token from studio, redirecting to central auth", err);
                    Env.logger.error("Failed to fetch user token from studio, redirecting to central auth", {
                        vertesia: {
                            error: err,
                        },
                    });
                    redirectToCentralAuth();
                });
            return;
        } else {
            //if on a dev domain and not logged in, redirect to central auth
            if (!session.isLoggedIn()) {
                console.log("Auth: not logged in & no token/state");
                Env.logger.info("Not logged in & no token/state", {
                    vertesia: {
                        account_id: selectedAccount,
                        project_id: selectedProject,
                    },
                });
                if (shouldRedirectToCentralAuth()) {
                    console.log(
                        "Auth: on dev domain, redirecting to central auth with selection",
                        selectedAccount,
                        selectedProject,
                    );
                    Env.logger.info("Redirecting to central auth with selection", {
                        vertesia: {
                            account_id: selectedAccount,
                            project_id: selectedProject,
                        },
                    });
                    redirectToCentralAuth();
                    return; // Don't register onAuthStateChanged listener when redirecting
                } else {
                    console.log("Auth: not on dev domain");
                    Env.logger.info("Not on dev domain", {
                        vertesia: {
                            account_id: selectedAccount,
                            project_id: selectedProject,
                        },
                    });
                }
            }
        }

        return onAuthStateChanged(getFirebaseAuth(), async (firebaseUser) => {
            if (firebaseUser) {
                console.log("Auth: successful login with firebase");
                Env.logger.info("Successful login with firebase", {
                    vertesia: {
                        account_id: selectedAccount,
                        project_id: selectedProject,
                    },
                });
                session.setSession = setSession;
                await getComposableToken(selectedAccount, selectedProject, undefined, false, shouldRedirectToCentralAuth())
                    .then((res) => {
                        session.login(res.rawToken).then(() => setSession(session.clone()));
                    })
                    .catch((err) => {
                        console.error("Failed to fetch user token from studio", err);
                        Env.logger.error("Failed to fetch user token from studio", {
                            vertesia: {
                                account_id: selectedAccount,
                                project_id: selectedProject,
                                error: err,
                            },
                        });
                        if (!(err instanceof UserNotFoundError)) session.logout();
                        session.isLoading = false;
                        session.authError = err;
                        setSession(session.clone());
                    });
            } else {
                // anonymous user
                console.log("Auth: using anonymous user");
                Env.logger.info("Using anonymous user", {
                    vertesia: {
                        account_id: selectedAccount,
                        project_id: selectedProject,
                    },
                });
                session.client.withAuthCallback(undefined);
                session.logout();
                setSession(session.clone());
            }
        });
    }, []);

    return <UserSessionContext.Provider value={session}>{children}</UserSessionContext.Provider>;
}
