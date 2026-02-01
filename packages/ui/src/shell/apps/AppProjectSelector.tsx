import { ProjectRef, RequireAtLeastOne } from "@vertesia/common";
import { SelectBox, useFetch } from "@vertesia/ui/core";
import { LastSelectedAccountId_KEY, LastSelectedProjectId_KEY, useUserSession } from "@vertesia/ui/session";
import { useState } from "react";

interface AppProjectSelectorProps {
    app: RequireAtLeastOne<{ id?: string, name?: string }, 'id' | 'name'>;
    onChange?: (value: ProjectRef) => void | boolean;
    placeholder?: string;
}
export function AppProjectSelector({ app, onChange, placeholder }: AppProjectSelectorProps) {
    const { client, project } = useUserSession();
    const { data: projects, error } = useFetch(() => {
        return client.apps.getAppInstallationProjects(app);
    }, [app.id, app.name])

    const _onChange = (project: ProjectRef) => {
        if (onChange) {
            if (!onChange(project)) {
                // if onChange returns true then the defualt on change is called
                return;
            }
        }
        // default on change
        localStorage.setItem(LastSelectedAccountId_KEY, project.account);
        localStorage.setItem(LastSelectedProjectId_KEY + '-' + project.account, project.id);
        window.location.reload();
    }

    if (error) {
        return <span className='text-red-600'>Error: failed to fetch projects: {error.message}</span>
    }
    return <SelectProject placeholder={placeholder} initialValue={project?.id} projects={projects || []} onChange={_onChange} />
}

interface SelectProjectProps {
    initialValue?: string
    projects: ProjectRef[]
    onChange: (value: ProjectRef) => void
    placeholder?: string;
}
function SelectProject({ initialValue, projects, onChange, placeholder = "Select Project" }: Readonly<SelectProjectProps>) {
    const [value, setValue] = useState<ProjectRef | undefined>();
    const _onChange = (value: ProjectRef) => {
        setValue(value)
        onChange(value)
    }
    let actualValue = !value && initialValue ? projects.find(p => p.id === initialValue) : value;
    return (
        <SelectBox
            by="id"
            value={actualValue}
            options={projects}
            optionLabel={(option) => option.name}
            placeholder={placeholder}
            onChange={_onChange} />
    )
}
