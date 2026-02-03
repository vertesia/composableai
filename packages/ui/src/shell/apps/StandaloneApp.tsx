import { AppInstallationWithManifest, ProjectRef } from "@vertesia/common";
import { Center, useFetch, SelectBox } from "@vertesia/ui/core";
import { LastSelectedAccountId_KEY, LastSelectedProjectId_KEY, useUserSession } from "@vertesia/ui/session";
import { LockIcon } from "lucide-react";
import { ComponentType, ReactNode, useEffect, useMemo, useState } from "react";
import { AppInstallationProvider } from "./AppInstallationProvider";


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
    const { project, accounts, client } = useUserSession();
    const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>();

    // Fetch all projects where the app is installed across all organizations
    const { data: allProjects } = useFetch(() => {
        return client.apps.getAppInstallationProjects({ name });
    }, [name]);

    // Group projects by organization
    const { projectsByOrg, orgOptions } = useMemo(() => {
        if (!allProjects || !accounts) return { projectsByOrg: {}, orgOptions: [] };

        const grouped: Record<string, ProjectRef[]> = {};
        for (const p of allProjects) {
            if (!grouped[p.account]) {
                grouped[p.account] = [];
            }
            grouped[p.account].push(p);
        }

        // Only show orgs that have projects with the app installed
        const orgsWithProjects = accounts.filter(a => grouped[a.id]?.length > 0);

        return { projectsByOrg: grouped, orgOptions: orgsWithProjects };
    }, [allProjects, accounts]);

    // Auto-select first org if not selected
    useEffect(() => {
        if (!selectedAccountId && orgOptions.length > 0) {
            setSelectedAccountId(orgOptions[0].id);
        }
    }, [orgOptions, selectedAccountId]);

    const onProjectChange = (selected: ProjectRef) => {
        localStorage.setItem(LastSelectedAccountId_KEY, selected.account);
        localStorage.setItem(LastSelectedProjectId_KEY + '-' + selected.account, selected.id);
        window.location.reload();
    };

    const filteredProjects = selectedAccountId ? (projectsByOrg[selectedAccountId] || []) : [];
    const selectedOrg = orgOptions.find(a => a.id === selectedAccountId);

    return (
        <Center className="pt-10 flex flex-col items-center text-center text-gray-700">
            <LockIcon className="w-10 h-10 mb-4 text-gray-500" />
            <div className="text-xl font-semibold">Access Denied</div>
            <div className="mt-2 text-sm text-gray-500">
                You don&apos;t have permission to view the <span className="font-semibold">{name}</span> app in project: <span className="font-semibold">&laquo;{project?.name}&raquo;</span>.
            </div>
            {orgOptions.length === 0 && allProjects !== undefined && (
                <div className="mt-4 text-sm text-gray-500">
                    This app is not installed in any project you have access to.
                </div>
            )}
            {orgOptions.length > 0 && (
                <div className="mt-4 flex flex-row gap-4 items-end">
                    {orgOptions.length > 1 && (
                        <div>
                            <div className="text-sm text-gray-500 mb-2">Organization</div>
                            <SelectBox
                                by="id"
                                value={selectedOrg}
                                options={orgOptions}
                                optionLabel={(option) => option.name}
                                placeholder="Select Organization"
                                onChange={(org) => setSelectedAccountId(org.id)}
                            />
                        </div>
                    )}
                    <div>
                        {orgOptions.length > 1 && <div className="text-sm text-gray-500 mb-2">Project</div>}
                        <SelectBox
                            by="id"
                            value={undefined}
                            options={filteredProjects}
                            optionLabel={(option) => option.name}
                            placeholder="Select Project"
                            onChange={onProjectChange}
                        />
                    </div>
                </div>
            )}
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
