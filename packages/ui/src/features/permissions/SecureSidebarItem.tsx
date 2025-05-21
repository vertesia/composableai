import { Permission } from "@vertesia/common";
import { SidebarItem, SidebarItemProps } from "@vertesia/ui/layout";
import { useUserPermissions } from "./UserPermissionsProvider";


interface SecureSidebarItemProps extends SidebarItemProps {
    permission: Permission | Permission[];
}
export function SecureSidebarItem({ permission, ...others }: SecureSidebarItemProps) {
    const perms = useUserPermissions();
    const hasPermission = perms.hasPermission(permission);
    if (!hasPermission) {
        return null;
    } else {
        return (
            <SidebarItem {...others} />
        )
    }
}
