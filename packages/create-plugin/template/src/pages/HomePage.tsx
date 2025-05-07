import { useNavigate, useUserSession } from "@vertesia/ui/context";
import { useEffect } from "react";

interface HomePageProps {
}
export function HomePage({ }: HomePageProps) {
    const { user, client } = useUserSession();
    const navigate = useNavigate();

    useEffect(() => {
        client.plugins.list().then((plugins) => {
            console.log("Plugins:", plugins);
        })
    }, []);

    const goToTest = () => {
        navigate('/test');
    }

    return (
        <div className="text-green-800 p-4">
            <h1>Welcome {user?.email}!</h1>
            <div className="pt-4">
                <button className="bg-blue-500 text-white px-4 py-2 rounded" onClick={goToTest}>
                    Go to test page
                </button>
            </div>
        </div>
    )
}