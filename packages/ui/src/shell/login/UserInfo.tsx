import { getTenantIdFromProject } from "@vertesia/common";
import { VTabs, VTabsBar, VTabsPanel, VTooltip } from "@vertesia/ui/core";
import { Env } from "@vertesia/ui/env";
import { useUserSession } from "@vertesia/ui/session";
import { Check, CopyIcon } from "lucide-react";
import { useState } from "react";

export function InfoItems({ title, value }: { title: string, value: string }) {
    function copyToClipboard(value: string) {
        navigator.clipboard.writeText(value);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    }
    const [isCopied, setIsCopied] = useState(false);
    return (
        <div className="w-full flex justify-between items-center mb-1">
            <div className="flex flex-col w-[calc(100%-3rem)]">
                <div className='text-sm px-2 dark:text-slate-200'>{title}</div>
                <VTooltip description={value} size="xs" placement="left">
                    <div className='text-xs truncate text-muted w-full text-left px-2'>{value} </div>
                </VTooltip>
            </div>
            {isCopied ?
                <Check className="size-4 cursor-pointer text-success" />
                :
                <CopyIcon className="size-4 cursor-pointer text-gray-400 dark:text-slate-400"
                    onClick={() => copyToClipboard(value)} />
            }
        </div>
    )
}

export default function InfoList() {

    const session = useUserSession();
    const { account, project, client, authToken } = session;
    const server = new URL(client.baseUrl).hostname;
    const store = new URL(client.store.baseUrl).hostname;
    const tenantId = project ? getTenantIdFromProject(project) : '';

    const tabs = [
        {
            name: 'user',
            label: 'User',
            content:
                <div className="space-y-1 p-2">
                    <InfoItems title="Organization ID" value={account?.id ?? 'Unknown'} />
                    <InfoItems title="Project ID" value={project?.id ?? 'Unknown'} />
                    <InfoItems title="User ID" value={authToken?.sub ?? 'Unknown'} />
                    <InfoItems title="Organization Roles" value={authToken?.account_roles?.join(',') ?? 'Unknown'} />
                    <InfoItems title="Project Roles" value={authToken?.project_roles?.join(',') ?? 'Unknown'} />
                </div>
        },
        {
            name: 'environment',
            label: 'Environment',
            content:
                <div className="space-y-1 p-2">
                    <InfoItems title="Tenant ID" value={tenantId} />
                    <InfoItems title="Environment" value={Env.type} />
                    <InfoItems title="Server" value={server} />
                    <InfoItems title="Store" value={store} />
                    <InfoItems title="App Version" value={Env.version} />
                </div>
        }
    ];

    return (
        <div className="w-full">
            <VTabs defaultValue="user" tabs={tabs} fullWidth>
                <VTabsBar />
                <VTabsPanel />
            </VTabs>
        </div>
    )
}