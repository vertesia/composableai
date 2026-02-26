import { createContext, useContext } from 'react';
import type { CollectionInfo, ResourceItem, ServerInfo } from './types.js';

export interface AdminContextValue {
    serverInfo: ServerInfo;
    collections: CollectionInfo[];
    resources: ResourceItem[];
    baseUrl: string;
}

export const AdminContext = createContext<AdminContextValue | undefined>(undefined);

export function useAdminContext(): AdminContextValue {
    const ctx = useContext(AdminContext);
    if (!ctx) throw new Error('useAdminContext must be used within AdminApp');
    return ctx;
}
