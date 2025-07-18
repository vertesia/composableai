import { GoogleAuthProvider, signInWithRedirect } from "firebase/auth";
import { getFirebaseAuth } from "@vertesia/ui/session";
import { Button } from "@vertesia/ui/core";

interface GoogleSignInButtonProps {
    redirectTo?: string;
}
export default function GoogleSignInButton({ redirectTo }: GoogleSignInButtonProps) {

    const signIn = () => {
        localStorage.removeItem("tenantName");
        let redirectPath = redirectTo || window.location.pathname || '/';
        if (redirectPath[0] !== '/') {
            redirectPath = '/' + redirectPath;
        }
        const provider = new GoogleAuthProvider();
        provider.addScope('profile');
        provider.addScope('email');
        // always ask to select the google account
        //console.log('redirectPath', window.location.origin + redirectPath)
        provider.setCustomParameters({
            prompt: 'select_account',
            redirect_uri: window.location.origin + redirectPath
        });
        signInWithRedirect(getFirebaseAuth(), provider);
    };

    return (
        <Button variant={"outline"}
            onClick={signIn}
            className="w-full py-5 flex rounded-lg hover:shadow-sm transition duration-150 text-center mb-2">
            <img className="size-6" src="https://www.svgrepo.com/show/475656/google-color.svg" loading="lazy" alt="google logo" />
            <span className="text-sm font-semibold">Continue with Google</span>
        </Button>
    );
}
