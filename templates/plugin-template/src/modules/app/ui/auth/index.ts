import type { AuthScreens } from '@vertesia/ui/shell';
import { AppAuthLoadingPage } from './AppAuthLoadingPage';
import { AppPermissionLoadingPage } from './AppPermissionLoadingPage';
import { AppSignInPage } from './AppSignInPage';

export const appAuthScreens = {
    SignIn: AppSignInPage,
    Loading: AppAuthLoadingPage,
    Permissions: AppPermissionLoadingPage,
} satisfies AuthScreens;
