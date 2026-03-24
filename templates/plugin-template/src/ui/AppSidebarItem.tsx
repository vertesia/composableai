import { SidebarItem, type SidebarItemProps } from '@vertesia/ui/layout';
import { Path, useRouterBasePath } from '@vertesia/ui/router';

interface AppSidebarItemProps extends Omit<SidebarItemProps, 'href' | 'to'> {
    to: string;
}

export function AppSidebarItem({ to, ...props }: AppSidebarItemProps) {
    const basePath = useRouterBasePath();

    return (
        <SidebarItem
            {...props}
            href={Path.joinPath(basePath, to)}
            to={to}
        />
    );
}
