import type { ComponentType, PropsWithChildren, ReactNode } from 'react';

type ProviderComponent = ComponentType<PropsWithChildren>;

interface ProviderChainProps {
    providers: ProviderComponent[];
    children: ReactNode;
}

export function ProviderChain({ providers, children }: ProviderChainProps) {
    return (
        <>
            {providers.reduceRight<ReactNode>(
                (child, Provider, index) => (
                    <Provider key={Provider.displayName ?? Provider.name ?? index}>{child}</Provider>
                ),
                children,
            )}
        </>
    );
}
