import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { useUserSession } from '@vertesia/ui/session';
import { TypeRegistry } from './TypeRegistry.js';

interface TypeRegistryContextValue {
    registry: TypeRegistry | undefined;
    isLoading: boolean;
    load: () => Promise<void>;
    reload: () => Promise<void>;
}

const TypeRegistryContext = createContext<TypeRegistryContextValue>({
    registry: undefined,
    isLoading: false,
    load: () => Promise.resolve(),
    reload: () => Promise.resolve(),
});

interface TypeRegistryProviderProps {
    children: ReactNode;
}

export function TypeRegistryProvider({ children }: TypeRegistryProviderProps) {
    const { store, project } = useUserSession();
    const [registry, setRegistry] = useState<TypeRegistry | undefined>();
    const [isLoading, setIsLoading] = useState(false);
    const fetchRef = useRef(false);

    const load = useCallback(async () => {
        if (!project || fetchRef.current) return;
        fetchRef.current = true;
        setIsLoading(true);
        try {
            const types = await store.types.catalog.list({ layout: true });
            setRegistry(new TypeRegistry(types));
        } catch (err) {
            console.error('Failed to fetch types', err);
        } finally {
            setIsLoading(false);
            fetchRef.current = false;
        }
    }, [store, project]);

    const reload = useCallback(async () => {
        fetchRef.current = false;
        return load();
    }, [load]);

    // Reset when project changes
    useEffect(() => {
        setRegistry(undefined);
        fetchRef.current = false;
    }, [project]);

    return (
        <TypeRegistryContext.Provider value={{ registry, isLoading, load, reload }}>
            {children}
        </TypeRegistryContext.Provider>
    );
}

export function useTypeRegistry() {
    const ctx = useContext(TypeRegistryContext);

    useEffect(() => {
        if (!ctx.registry && !ctx.isLoading) {
            ctx.load();
        }
    }, [ctx.registry, ctx.isLoading]);

    return ctx;
}
