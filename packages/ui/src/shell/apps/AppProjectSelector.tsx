import type { ProjectRef, RequireAtLeastOne } from '@vertesia/common';
import { errorMessage, SelectBox, useFetch } from '@vertesia/ui/core';
import { rememberScopeSelection, useUserSession } from '@vertesia/ui/session';

interface AppProjectSelectorProps {
    app: RequireAtLeastOne<{ id?: string; name?: string }, 'id' | 'name'>;
    // biome-ignore lint/suspicious/noConfusingVoidType: void in union is intentional — handlers return boolean (true delegates to default) or nothing
    onChange?: (value: ProjectRef) => void | boolean;
    placeholder?: string;
}

/**
 * Picks the project an app runs in. The selection always shows the session's project: picking
 * another one reloads the page into it (unless `onChange` handles the switch itself), so the view
 * never renders one project's data under another project's name.
 */
export function AppProjectSelector({ app, onChange, placeholder = 'Select Project' }: AppProjectSelectorProps) {
    const { client, project } = useUserSession();
    const { data: projects, error } = useFetch(() => {
        return client.apps.getAppInstallationProjects(app);
    }, [app.id, app.name]);

    const _onChange = (selected: ProjectRef) => {
        if (selected.id === project?.id) {
            return;
        }
        // A handler returning true also runs the default switch.
        if (onChange && !onChange(selected)) {
            return;
        }
        rememberScopeSelection(selected.account, selected.id);
        location.reload();
    };

    if (error) {
        return <span className="text-destructive">Error: failed to fetch projects: {errorMessage(error)}</span>;
    }
    return (
        <SelectBox
            by="id"
            value={projects?.find((p) => p.id === project?.id)}
            options={projects || []}
            optionLabel={(option) => option.name}
            placeholder={placeholder}
            onChange={_onChange}
        />
    );
}
