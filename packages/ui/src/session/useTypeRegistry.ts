import { useEffect, useState } from 'react';
import { useUserSession } from './UserSession';
import { TypeRegistry } from './TypeRegistry';

/**
 * Hook to load and access the type registry.
 * Automatically loads types on mount and provides the registry once loaded.
 *
 * @returns TypeRegistry or undefined if not yet loaded
 */
export function useTypeRegistry(): TypeRegistry | undefined {
    const session = useUserSession();
    const [typeRegistry, setTypeRegistry] = useState<TypeRegistry | undefined>(undefined);

    useEffect(() => {
        session.typeRegistry().then(registry => {
            setTypeRegistry(registry);
        });
    }, [session]);

    return typeRegistry;
}
