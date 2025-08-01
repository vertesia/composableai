import { ProjectRef, RequireAtLeastOne } from "@vertesia/common";
import { SelectBox, useFetch } from "@vertesia/ui/core";
import { useUserSession } from "@vertesia/ui/session";
import { useState } from "react";

interface AppProjectSelectorProps {
    app: RequireAtLeastOne<{ id?: string, name?: string }, 'id' | 'name'>;
    onChange: (value: ProjectRef) => void;
    placeholder?: string;
}
export function AppProjectSelector({ app, onChange, placeholder }: AppProjectSelectorProps) {
    const { client, project } = useUserSession();
    const { data: projects, error } = useFetch(() => {
        return client.apps.getAppInstallationProjects(app);
    }, [app.id, app.name])

    if (error) {
        return <span className='text-red-600'>Error: failed to fetch projects: {error.message}</span>
    }

    return <SelectProject placeholder={placeholder} initialValue={project?.id} projects={projects || []} onChange={onChange} />
}

interface SelectProjectProps {
    initialValue?: string
    projects: ProjectRef[]
    onChange: (value: ProjectRef) => void
    placeholder?: string;
}
function SelectProject({ initialValue, projects, onChange, placeholder = "Select Project" }: Readonly<SelectProjectProps>) {
    const [value, setValue] = useState<ProjectRef | undefined>(() => {
        return initialValue ? projects.find(p => p.id === initialValue) : undefined
    });
    const _onChange = (value: ProjectRef) => {
        setValue(value)
        onChange(value)
    }
    return (
        <SelectBox
            by="id"
            value={value}
            options={projects}
            optionLabel={(option) => option.name}
            placeholder={placeholder}
            onChange={_onChange} />
    )
}
