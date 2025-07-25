import { ProjectRoles } from "@vertesia/common";
import { ErrorBox } from "@vertesia/ui/core";
import { useUserSession } from "@vertesia/ui/session";
import { ReactNode, useEffect, useState } from "react";


export function CheckAppAccess({ name, children }: { name: string, children: ReactNode }) {
    const [hasAccess, setHasAccess] = useState<boolean | null>(null);
    const { authToken } = useUserSession();

    useEffect(() => {
        if (authToken) {
            const appRoles = authToken.app_roles[name];
            const hasAccess = appRoles.includes(ProjectRoles.app_user) || appRoles.includes(ProjectRoles.app_reader);
            setHasAccess(hasAccess);
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