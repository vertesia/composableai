import type { ComponentType, ReactNode, PropsWithChildren } from 'react';

type ProviderComponent = ComponentType<PropsWithChildren>;

interface ProviderChainProps {
    providers: ProviderComponent[];
    children: ReactNode;
}

export function ProviderChain({ providers, children }: ProviderChainProps) {
    return <>{providers.reduceRight<ReactNode>((child, Provider) => <Provider>{child}</Provider>, children)}</>;
}
