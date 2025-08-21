import { AppInstallationWithManifest, ProjectRef } from "@vertesia/common";
import { Center } from "@vertesia/ui/core";
import { LastSelectedAccountId_KEY, LastSelectedProjectId_KEY, useUserSession } from "@vertesia/ui/session";
import { LockIcon } from "lucide-react";
import { ComponentType, ReactNode, useEffect, useState } from "react";
import { AppInstallationProvider } from "./AppInstallationProvider";
import { AppProjectSelector } from "./AppProjectSelector";


interface StandaloneAppProps {
    /**
     * The app name. 
     * The name must be the name used to register the app in Vertesia. It will be used to check if thre user has access to the app.
     * 
     * Also, this component is providing an AppInfo context that can be retrieved using the useAppInfo() hook.
     */
    name: string;

    /**
     * A react element to display if the access is denied to the app.
     * If not specified a simple message will be displayed
     */
    AccessDenied?: ComponentType<AccessDeniedMessageProps>;

    children: ReactNode;
}
export function StandaloneApp({ name, AccessDenied = AccessDeniedMessage, children }: StandaloneAppProps) {
    return name ? (
        <StandaloneAppImpl name={name} AccessDenied={AccessDenied}>{children}</StandaloneAppImpl>
    ) : (
        <UnknownAppName />
    )
}
export function StandaloneAppImpl({ name, AccessDenied = AccessDeniedMessage, children }: StandaloneAppProps) {
    const { authToken, client } = useUserSession();
    const [installation, setInstallation] = useState<AppInstallationWithManifest | null>(null)
    const [state, setState] = useState<"loading" | "error" | "loaded">("loading");

    useEffect(() => {
        if (!authToken) {
            setState("loading");
        } else {
            const isAppVisible = authToken.apps.includes(name);
            if (isAppVisible) {
                client.apps.getAppInstallationByName(name).then(inst => {
                    if (!inst) {
                        console.log(`App ${name} not found!`);
                        setState("error");
                    } else {
                        setState("loaded");
                        setInstallation(inst);
                    }
                });
            } else {
                setState("error");
            }
        }
    }, [name, authToken]);

    if (state === "loading") {
        return null;
    } else if (state === "error") {
        return <AccessDenied name={name} />
    } else if (installation) {
        return <AppInstallationProvider installation={installation}>
            {children}
        </AppInstallationProvider>
    }
}

interface AccessDeniedMessageProps {
    name: string;
}
function AccessDeniedMessage({ name }: AccessDeniedMessageProps) {
    const { project } = useUserSession();
    const onChange = (project: ProjectRef) => {
        localStorage.setItem(LastSelectedAccountId_KEY, project.account);
        localStorage.setItem(LastSelectedProjectId_KEY + '-' + project.account, project.id);
        window.location.reload();
    }
    return (
        <Center className="pt-10 flex flex-col items-center text-center text-gray-700">
            <LockIcon className="w-10 h-10 mb-4 text-gray-500" />
            <div className="text-xl font-semibold">Access Denied</div>
            <div className="mt-2 text-sm text-gray-500">
                You don&apos;t have permission to view the <span className="font-semibold">{name}</span> app in project: <span className="font-semibold">&laquo;{project?.name}&raquo;</span>.
            </div>
            <div className="mt-4">
                <AppProjectSelector app={{ name }} onChange={onChange} />
            </div>
        </Center>
    )
}

function UnknownAppName() {
    return (
        <Center className="pt-10 flex flex-col items-center text-center text-gray-700">
            <LockIcon className="w-10 h-10 mb-4 text-gray-500" />
            <div className="text-xl font-semibold">Application not registered</div>
            <div className="mt-2 text-sm text-gray-500">
                Before starting to code a Vertesia application you must register an application manifest
                in Vertesia Studio then install it in one or more projects.
                <p />
                Then use the created app name as a parameter to <code>&lt;StandaloneApp name=&quot;your-app-name&quot;&gt;</code> in the <code>src/main.tsx</code> file.
            </div>
        </Center>
    )
}
