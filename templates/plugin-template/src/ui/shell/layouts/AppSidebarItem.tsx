import { SidebarItem, type SidebarItemProps } from '@vertesia/ui/layout';
import { Path } from '@vertesia/ui/router';

interface AppSidebarItemProps extends Omit<SidebarItemProps, 'href' | 'to'> {
    basePath: string;
    to: string;
}

export function AppSidebarItem({ basePath, to, ...props }: AppSidebarItemProps) {
    return <SidebarItem {...props} href={Path.joinPath(basePath, to)} to={to} />;
}
