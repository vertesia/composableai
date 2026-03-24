import { getTenantIdFromProject } from "@vertesia/common";
import { Tabs, TabsBar, TabsPanel, VTooltip } from "@vertesia/ui/core";
import { Env } from "@vertesia/ui/env";
import { useUserSession } from "@vertesia/ui/session";
// Package version is now passed as prop from the consuming application
import { Check, CopyIcon } from "lucide-react";
import { useState } from "react";
import { useUITranslation } from '../../i18n/index.js';

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
    const { t } = useUITranslation();

    const session = useUserSession();
    const { account, project, client, authToken } = session;
    const server = new URL(client.baseUrl).hostname;
    const store = new URL(client.store.baseUrl).hostname;
    const tenantId = project ? getTenantIdFromProject(project) : '';

    const tabs = [
        {
            name: 'user',
            label: t('user.user'),
            content:
                <div className="space-y-1 p-2">
                    <InfoItems title={t('user.organizationId')} value={account?.id ?? t('user.unknown')} />
                    <InfoItems title={t('user.projectId')} value={project?.id ?? t('user.unknown')} />
                    <InfoItems title={t('user.userId')} value={authToken?.sub ?? t('user.unknown')} />
                    <InfoItems title={t('user.organizationRoles')} value={authToken?.account_roles?.join(',') ?? t('user.unknown')} />
                    <InfoItems title={t('user.projectRoles')} value={authToken?.project_roles?.join(',') ?? t('user.unknown')} />
                </div>
        },
        {
            name: 'environment',
            label: t('user.environment'),
            content:
                <div className="space-y-1 p-2">
                    <InfoItems title={t('user.tenantId')} value={tenantId} />
                    <InfoItems title={t('user.environment')} value={Env.type} />
                    <InfoItems title={t('user.server')} value={server} />
                    <InfoItems title={t('user.store')} value={store} />
                    <InfoItems title={t('user.appVersion')} value={Env.version} />
                    <InfoItems title={t('user.sdkVersion')} value={Env.sdkVersion || t('user.unknown')} />
                </div>
        }
    ];

    return (
        <div className="w-full">
            <Tabs defaultValue="user" tabs={tabs} fullWidth updateHash={false}>
                <TabsBar />
                <TabsPanel />
            </Tabs>
        </div>
    )
}