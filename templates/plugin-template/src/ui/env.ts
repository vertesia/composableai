import { Env } from '@vertesia/ui/env';

const CONFIG__PLUGIN_TITLE = 'Ui Plugin Template';
const CONFIG__STUDIO_URL = 'https://api.vertesia.io';
const CONFIG__ZENO_URL = 'https://api.vertesia.io';
const CONFIG__STS_URL = 'https://sts.vertesia.io';

document.title = CONFIG__PLUGIN_TITLE;

Env.init({
    name: CONFIG__PLUGIN_TITLE,
    version: '1.0.0',
    isLocalDev: true,
    isDocker: true,
    type: 'development',
    endpoints: {
        studio: import.meta.env.VITE_STUDIO_URL ?? CONFIG__STUDIO_URL,
        zeno: import.meta.env.VITE_ZENO_URL ?? CONFIG__ZENO_URL,
        sts: import.meta.env.VITE_STS_URL ?? CONFIG__STS_URL,
    },
});
