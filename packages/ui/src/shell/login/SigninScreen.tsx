import { SignupData, SignupPayload } from "@vertesia/common";
import { Button, useSafeLayoutEffect } from "@vertesia/ui/core";
import { Env } from "@vertesia/ui/env";
import { useUITranslation } from "@vertesia/ui/i18n";
import { UserNotFoundError, useUserSession, useUXTracking } from "@vertesia/ui/session";
import clsx from "clsx";
import { useEffect, useState } from "react";
import EnterpriseSigninButton from "./EnterpriseSigninButton";
import GitHubSignInButton from "./GitHubSignInButton";
import GoogleSignInButton from "./GoogleSignInButton";
import MicrosoftSignInButton from "./MicrosoftSigninButton";
import SignupForm from "./SignupForm";

interface SigninScreenProps {
    isNested?: boolean;
    allowedPrefix?: string;
    lightLogo?: string;
    darkLogo?: string;
}
export function SigninScreen({ allowedPrefix, isNested = false, lightLogo, darkLogo }: SigninScreenProps) {
    const [allow, setAllow] = useState(false);
    useSafeLayoutEffect(() => {
        allowedPrefix && setAllow(window.location.href.startsWith(allowedPrefix));
    }, []);
    return allow ? null : <SigninScreenImpl isNested={isNested} lightLogo={lightLogo} darkLogo={darkLogo} />;
}

function SigninScreenImpl({ isNested = false, lightLogo, darkLogo }: SigninScreenProps) {
    const { t } = useUITranslation();
    const { isLoading, user, authError } = useUserSession();

    return !isLoading && !user ? (
        <div
            style={{ zIndex: 999998 }}
            className={(isNested ? "absolute" : "fixed") + "overflow-y-auto "}
        >
            <div
                className={clsx(
                    "flex flex-col items-center justify-center py-14 px-4",
                )}
            >

                <StandardSigninPanel authError={authError} lightLogo={lightLogo} darkLogo={darkLogo} />
                <div className="flex gap-x-6 mt-10 justify-center text-muted">
                    <a href="https://vertesiahq.com/privacy" className="text-sm">
                        {t('auth.privacyPolicy')}
                    </a>
                    <a href="https://vertesiahq.com/terms" className="text-sm">
                        {t('auth.termsOfService')}
                    </a>
                </div>
            </div>
        </div>
    ) : null;
}

function StandardSigninPanel({ authError, darkLogo, lightLogo }: {
    authError?: Error,
    darkLogo?: string,
    lightLogo?: string
}) {
    const { t } = useUITranslation();
    const [signupData, setSignupData] = useState<SignupData | undefined>(undefined);
    const [collectSignupData, setCollectSignupData] = useState(false);
    const { signOut } = useUserSession();
    const { trackEvent } = useUXTracking();

    history.replaceState({}, '', '/');

    const goBack = () => {
        console.log("Going back, signing out");
        setSignupData(undefined);
        setCollectSignupData(false);
        signOut();
    };

    const goToSignup = () => {
        setSignupData(undefined);
        setCollectSignupData(true);
    };

    useEffect(() => {
        if (authError instanceof UserNotFoundError) {
            console.log("User not found, redirecting to signup");
            goToSignup();
        }
    }, [authError]);

    const onSignup = (data: SignupData, fbToken: string) => {
        console.log("Got Signup data", data);
        setSignupData(data);
        const payload: SignupPayload = {
            signupData: data,
            firebaseToken: fbToken,
        };
        fetch(Env.endpoints.studio + "/auth/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        }).then((res) => {
            console.log("Signup successful", payload, res);

            trackEvent("sign_up");
            window.location.href = "/";
        });
    };

    return (
        <>
            {lightLogo && <img src={lightLogo} alt='logo' className='h-15 block dark:hidden' />}
            {darkLogo && <img src={darkLogo} alt='logo' className='h-15 hidden dark:block' />}

            {signupData && (
                <div className="my-6">
                    {t('auth.needToMakeChange')}{" "}
                    <Button onClick={goToSignup}> {t('auth.goBack')}</Button>
                </div>
            )}
            <div className="flex flex-col space-y-2">
                {collectSignupData && !localStorage.getItem('tenantName') ? (
                    <SignupForm onSignup={onSignup} goBack={goBack} />
                ) : (

                    <div className="flex flex-col">
                        <div className="my-4">
                            <h2 className="text-2xl font-bold text-center">{t('auth.logInOrSignUp')}</h2>
                        </div>
                        <div className="max-w-2xl text-center my-2 px-2">
                            {t('auth.firstTimeMessage')}
                            <br />
                            {t('auth.firstTimeDetails')}
                        </div>
                        <div className="flex items-center flex-col">
                            <div className="py-4 w-70">
                                <GoogleSignInButton />
                                <GitHubSignInButton />
                                <MicrosoftSignInButton />
                            </div>
                            <div className="flex items-center flex-row w-70 text-muted">
                                <hr className="w-full" />
                                <div className="px-2 text-xs">{t('auth.or')}</div>
                                <hr className="w-full" />
                            </div>
                            <div className="py-4 w-70">
                                <EnterpriseSigninButton />
                            </div>
                        </div>
                        {authError && !(authError instanceof UserNotFoundError) && (
                            <div className="text-center">
                                <div className="">
                                    {t('auth.signInError')}
                                    <br />
                                    {t('auth.signInErrorContact')}
                                    <a className='text-info mx-1' href="mailto:support@vertesiahq.com">support@vertesiahq.com</a>
                                    {t('auth.signInErrorPersists')}
                                    <pre className="mt-2">{t('auth.error', { message: authError.message })}</pre>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </>
    );
}
