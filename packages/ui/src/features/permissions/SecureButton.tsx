import type { Permission } from '@vertesia/common';
import { Button, type ButtonProps } from '@vertesia/ui/core';
import { useUserPermissions } from './UserPermissionsProvider';

interface SecureButtonProps extends ButtonProps {
    permission: Permission | Permission[];
}
export function SecureButton({ permission, isDisabled, title, children, ...others }: SecureButtonProps) {
    const perms = useUserPermissions();
    const hasPermission = perms.hasPermission(permission);
    if (!hasPermission) {
        return null;
    }
    return (
        <Button isDisabled={isDisabled} title={title} {...others}>
            {children}
        </Button>
    );
}
