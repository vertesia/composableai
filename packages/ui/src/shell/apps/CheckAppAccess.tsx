import { ErrorBox } from "@vertesia/ui/core";
import { useUserSession } from "@vertesia/ui/session";
import { ReactNode, useEffect, useState } from "react";


export function CheckAppAccess({ name, children }: { name: string, children: ReactNode }) {
    const [hasAccess, setHasAccess] = useState<boolean | null>(null);
    const { authToken } = useUserSession();

    useEffect(() => {
        if (authToken) {
            setHasAccess(authToken.apps?.includes(name) || false);
        }
    }, [authToken])

    if (hasAccess == null) {
        return null;
    }

    if (hasAccess) {
        return children;
    } else {
        return <ErrorBox title="Forbidden">Access is not granted to this application</ErrorBox>
    }
}