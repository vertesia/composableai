import { Button, Input, Spinner, useToast } from "@vertesia/ui/core";
import { Env } from "@vertesia/ui/env";
import { getFirebaseAuth, setFirebaseTenant, useUXTracking } from "@vertesia/ui/session";
import { GoogleAuthProvider, OAuthProvider, signInWithRedirect } from "firebase/auth";
import { useState } from "react";


function getProvider(redirectTo?: string) {
    const providerType = Env.firebase.providerType;
    switch (providerType) {
        case "oidc":
            return new OAuthProvider("oidc.main");
        case "google": {
            let redirectPath = redirectTo || window.location.pathname || '/';
            if (redirectPath[0] !== '/') {
                redirectPath = '/' + redirectPath;
            }
            const provider = new GoogleAuthProvider();
            provider.addScope('profile');
            provider.addScope('email');
            provider.setCustomParameters({
                prompt: 'select_account',
                redirect_uri: window.location.origin + redirectPath
            });
            return provider;
        }
        case "microsoft":
            return new OAuthProvider("microsoft.com");
        case "github":
            return new OAuthProvider("github.com");
        default:
            return new OAuthProvider("oidc.main");
    }
}

interface EnterpriseSigninButtonProps {
    redirectTo?: string;
}
export default function EnterpriseSigninButton({ redirectTo }: EnterpriseSigninButtonProps) {
    const [isLoading, setIsLoading] = useState(false);
    const { trackEvent } = useUXTracking();

    const [email, setEmail] = useState<string | undefined>("");
    const toast = useToast();

    const signIn = async () => {
        if (!email) return;

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            toast({
                title: "Invalid email address",
                status: "error",
                duration: 5000,
            });
            return;
        }
        // Env.firebase.tenantEmail = email;
        setIsLoading(true);
        setFirebaseTenant(email).then((data) => {
            if (!data) {
                toast({
                    title: "Tenant not found",
                    status: "error",
                    duration: 5000,
                });
                setIsLoading(false);
                return;
            }
            localStorage.setItem("tenantName", data.name ?? "");
            const provider = getProvider(redirectTo);
            trackEvent("enterprise_signin", {
                firebaseTenantName: data.name,
            });
            Env.logger.info('Enterprise single sign-in', {
                vertesia: {
                    email: email,
                    firebaseTenantName: data.name,
                    firebaseTenantId: data.firebaseTenantId,
                },
            });

            signInWithRedirect(getFirebaseAuth(), provider);
            setIsLoading(false);
        });
    };

    return (
        <>
            <Input value={email} onChange={setEmail} placeholder="Enter your enterprise email" type="email" />
            {
                isLoading ? (
                    <div className="w-full flex justify-center">
                        <Spinner />
                    </div>
                ) : (
                    <Button variant={"outline"}
                        onClick={signIn}
                        className="w-full mt-2 py-4 flex rounded-lg hover:shadow-sm transition duration-150 text-center">
                        <span className="text-sm font-semibold">Continue with Enterprise SSO</span>
                    </Button>
                )
            }
        </>
    );
}
