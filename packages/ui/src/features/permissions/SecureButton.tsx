import { Permission } from "@vertesia/common";
import { Button, ButtonProps } from "@vertesia/ui/core/components/shadcn/button";
import { useUserPermissions } from "./UserPermissionsProvider";

interface SecureButtonProps extends ButtonProps {
    permission: Permission | Permission[];
}
export function SecureButton({ permission, isDisabled, title, children, ...others }: SecureButtonProps) {
    const perms = useUserPermissions();
    const hasPermission = perms.hasPermission(permission);
    if (!hasPermission) {
        isDisabled = true;
        title = 'You do not have permission to perform this action';
    }
    return (
        <Button isDisabled={isDisabled} title={title} {...others}>{children}</Button>
    )
}