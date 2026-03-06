import type { ProjectRef } from '@vertesia/common';
import { SelectBox, Spinner, useFetch } from '@vertesia/ui/core';
import { LastSelectedAccountId_KEY, LastSelectedProjectId_KEY, useUserSession } from '@vertesia/ui/session';
import { LockIcon } from 'lucide-react';
import { useMemo, useState } from 'react';

interface PluginAccessDeniedProps {
    name: string;
}

export function PluginAccessDenied({ name }: PluginAccessDeniedProps) {
    const { client, user, accounts, account, project } = useUserSession();
    const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>(account?.id);

    const effectiveAccountId = useMemo(() => {
        if (selectedAccountId) return selectedAccountId;
        if (accounts && accounts.length > 0) return accounts[0].id;
        return undefined;
    }, [selectedAccountId, accounts]);

    const { data: allProjects } = useFetch(
        () => user ? client.projects.list() : Promise.resolve([]),
        [user]
    );

    const filteredProjects = useMemo(() => {
        if (!allProjects || !effectiveAccountId) return [];
        return allProjects.filter(p => p.account === effectiveAccountId);
    }, [allProjects, effectiveAccountId]);

    const onAccountChange = (selected: { id: string }) => {
        setSelectedAccountId(selected.id);
    };

    const onProjectChange = (selected: ProjectRef) => {
        localStorage.setItem(LastSelectedAccountId_KEY, selected.account);
        localStorage.setItem(`${LastSelectedProjectId_KEY}-${selected.account}`, selected.id);
        window.location.reload();
    };

    const hasMultipleAccounts = accounts && accounts.length > 1;
    const hasMultipleProjects = filteredProjects.length > 1;
    const showSelectors = hasMultipleAccounts || hasMultipleProjects;

    if (!allProjects) {
        return (
            <div className="w-full flex justify-center pt-10">
                <Spinner size="lg" />
            </div>
        );
    }

    const selectedOrg = accounts?.find(a => a.id === effectiveAccountId);

    return (
        <div className="w-full flex flex-col items-center gap-4 mt-24">
            <div className="w-1/3">
                <div className="mb-8 flex flex-col items-center text-center">
                    <LockIcon className="w-10 h-10 mb-4 text-muted-foreground" />
                    <div className="text-xl font-semibold">Access Denied</div>
                    <div className="mt-2 text-sm text-muted-foreground">
                        You don&apos;t have permission to view the <span className="font-semibold text-foreground">{name}</span> app
                        in project: <span className="font-semibold text-foreground">&laquo;{project?.name}&raquo;</span>.
                    </div>
                </div>
                {showSelectors && (
                    <>
                        <div className="mb-4 text-sm text-muted-foreground">
                            Switch to a different account or project to access this app.
                        </div>
                        {hasMultipleAccounts && (
                            <div className="mb-4 flex flex-col gap-2">
                                <span className="font-semibold text-muted-foreground">Account</span>
                                <SelectBox
                                    by="id"
                                    value={selectedOrg}
                                    options={accounts ?? []}
                                    optionLabel={(option) => option.name}
                                    placeholder="Select Account"
                                    onChange={onAccountChange}
                                />
                            </div>
                        )}
                        {hasMultipleProjects && (
                            <div className="mb-4 flex flex-col gap-2">
                                <span className="font-semibold text-muted-foreground">Project</span>
                                <SelectBox
                                    by="id"
                                    value={undefined}
                                    options={filteredProjects}
                                    optionLabel={(option) => option.name}
                                    placeholder="Select Project"
                                    onChange={onProjectChange}
                                />
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
