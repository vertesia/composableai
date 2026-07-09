import { AppEntry } from './AppEntry';
import { routes as appRoutes } from '../modules/app/ui/routes';
import { routes as assistantRoutes } from '../modules/assistant/ui/routes';
import { AppProviders as AssistantProviders } from '../modules/assistant/ui';

export { AppEntry };

export const routes = [...appRoutes, ...assistantRoutes];

export const providers = [AssistantProviders];
