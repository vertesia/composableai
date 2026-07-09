import { routes as appRoutes } from '../modules/app/ui/routes';
import { AppProviders as AssistantProviders } from '../modules/assistant/ui';
import { routes as assistantRoutes } from '../modules/assistant/ui/routes';

export const routes = [...appRoutes, ...assistantRoutes];

export const providers = [AssistantProviders];
