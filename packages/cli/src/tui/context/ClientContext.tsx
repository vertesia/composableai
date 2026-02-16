import { type ReactNode, createContext, useContext, useEffect, useState } from 'react';
import type { VertesiaClient } from '@vertesia/client';
import { getClient } from '../../client.js';

interface ClientContextValue {
    client: VertesiaClient | null;
    error: string | null;
    loading: boolean;
}

const ClientContext = createContext<ClientContextValue>({
    client: null,
    error: null,
    loading: true,
});

export function ClientProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<ClientContextValue>({
        client: null,
        error: null,
        loading: true,
    });

    useEffect(() => {
        getClient()
            .then(client => setState({ client, error: null, loading: false }))
            .catch(err => setState({ client: null, error: String(err), loading: false }));
    }, []);

    return (
        <ClientContext.Provider value={state}>
            {children}
        </ClientContext.Provider>
    );
}

export function useClient(): ClientContextValue {
    return useContext(ClientContext);
}
