import { NestedRouterProvider } from '@vertesia/ui/router';
import { providers, routes } from '../app-ui-modules';
import { ProviderChain } from './components/ProviderChain';

export function App() {
    return (
        <ProviderChain providers={providers}>
            <NestedRouterProvider routes={routes} />
        </ProviderChain>
    );
}
