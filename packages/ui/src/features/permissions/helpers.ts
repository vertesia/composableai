import { Permission } from "@vertesia/common";


export function AnyOf(...permissions: Permission[]): Permission[] {
    const p = Array.from(permissions);
    (p as any).__AnyOf__ = true;
    return p;
}

export function AllOf(...permissions: Permission[]): Permission[] {
    return Array.from(permissions);
}

export function isAnyOf(permissions: Permission[]) {
    return (permissions as any).__AnyOf__ === true;
}