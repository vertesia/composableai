import { Env } from "@vertesia/ui/env";

const CONFIG__PLUGIN_TITLE = "Ui Plugin Template";
const isDev = import.meta.env.DEV;
const devApiEndpoint = "/vertesia-api";
const devStsEndpoint = "https://sts.dev1.vertesia.io";

document.title = CONFIG__PLUGIN_TITLE;

Env.init({
    name: CONFIG__PLUGIN_TITLE,
    version: "1.0.0",
    isLocalDev: true,
    isDocker: true,
    type: "development",
    devAuthToken: isDev ? import.meta.env.VITE_VERTESIA_AUTH_TOKEN : undefined,
    endpoints: {
        studio: import.meta.env.VITE_VERTESIA_STUDIO_URL ?? (isDev ? devApiEndpoint : "https://api.us1.vertesia.io"),
        zeno: import.meta.env.VITE_VERTESIA_ZENO_URL ?? (isDev ? devApiEndpoint : "https://api.us1.vertesia.io"),
        sts: import.meta.env.VITE_VERTESIA_STS_URL ?? (isDev ? devStsEndpoint : "https://sts.us1.vertesia.io"),
    }
});
