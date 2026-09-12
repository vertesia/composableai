import { defineAppBranding } from '@vertesia/ui/boot';

const CONFIG__PLUGIN_TITLE = 'Vertesia';

/** App-owned: keep this directory when upgrading the template. Asset paths are relative to this file. */
export default defineAppBranding({
    name: CONFIG__PLUGIN_TITLE,
    logo: {
        light: '../../../../public/logo-light.png',
        dark: '../../../../public/logo-dark.png',
        alt: 'Vertesia',
    },
    loadingIcon: { light: '../../../../public/icon.svg' },
});
