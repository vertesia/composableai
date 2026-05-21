import { Permission } from "@vertesia/common";

type PermissionSet = Permission[] & {
    __AnyOf__?: boolean;
};

export function AnyOf(...permissions: Permission[]): Permission[] {
    const p: PermissionSet = Array.from(permissions);
    p.__AnyOf__ = true;
    return p;
}

export function AllOf(...permissions: Permission[]): Permission[] {
    return Array.from(permissions);
}

export function isAnyOf(permissions: Permission[]) {
    return (permissions as PermissionSet).__AnyOf__ === true;
}
