import { OAuthProvider, signInWithRedirect } from "firebase/auth";
import { getFirebaseAuth } from "@vertesia/ui/session";
import { Button } from "@vertesia/ui/core";

interface GoogleSignInButtonProps {
    redirectTo?: string;
}
export default function MicrosoftSignInButton({ redirectTo }: GoogleSignInButtonProps) {

    const signIn = () => {
        localStorage.removeItem("tenantName");
        let redirectPath = redirectTo || window.location.pathname || '/';
        if (redirectPath[0] !== '/') {
            redirectPath = '/' + redirectPath;
        }
        const provider = new OAuthProvider('microsoft.com');
        provider.addScope('profile');
        provider.addScope('email');
        signInWithRedirect(getFirebaseAuth(), provider);
    };

    return (
        <Button variant={"outline"}
            onClick={signIn}
            className="w-full py-5 flex rounded-lg hover:shadow-sm transition duration-150 text-center">
            <img className="size-6" src="https://learn.microsoft.com/en-us/entra/identity-platform/media/howto-add-branding-in-apps/ms-symbollockup_mssymbol_19.svg" loading="lazy" alt="microsoft logo" />
            <span className="text-sm font-semibold">Continue with Microsoft</span>
        </Button>
    );
}
