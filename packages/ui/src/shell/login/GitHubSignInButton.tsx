import { GithubAuthProvider, signInWithRedirect } from "firebase/auth";
import { getFirebaseAuth } from "@vertesia/ui/session";
import { Button } from "@vertesia/ui/core";

interface GitHubSignInButtonProps {
    redirectTo?: string;
}
export default function GitHubSignInButton({ }: GitHubSignInButtonProps) {
    const signIn = () => {
        localStorage.removeItem("tenantName");
        //with github can only have one allowed redirect
        const baseUrl = "https://dengenlabs.firebaseapp.com/__/auth/handler";
        let redirectPath = baseUrl + window.location.pathname;
        if (redirectPath[0] !== "/") {
            redirectPath = "/" + redirectPath;
        }
        const provider = new GithubAuthProvider();
        provider.addScope("profile");
        provider.addScope("email");
        /*provider.setCustomParameters({
            redirect_uri: redirectPath,
        });*/
        signInWithRedirect(getFirebaseAuth(), provider);
    };

    return (
        <Button variant={"outline"}
            onClick={signIn}
            className="w-full py-5 flex rounded-lg hover:shadow-sm transition duration-150 text-center mb-2">
            {/* <Github className="size-6" /> */}
            <img
                className="size-6 bg-white rounded-full"
                src="https://www.svgrepo.com/show/503359/github.svg"
                loading="lazy"
                alt="github logo"
            />
            <span className="text-sm font-semibold">Continue with GitHub</span>
        </Button>
    );
}
