import { Env } from "@vertesia/ui/env";

const CONFIG__PLUGIN_TITLE = "Ui Plugin Template";
const isDev = import.meta.env.DEV;
const devApiEndpoint = "/vertesia-api";

document.title = CONFIG__PLUGIN_TITLE;

const envConfig: Parameters<typeof Env.init>[0] & { devAuthToken?: string } = {
    name: CONFIG__PLUGIN_TITLE,
    version: "1.0.0",
    isLocalDev: true,
    isDocker: true,
    type: "development",
    devAuthToken: isDev ? import.meta.env.VITE_VERTESIA_AUTH_TOKEN : undefined,
    endpoints: {
        studio: import.meta.env.VITE_VERTESIA_STUDIO_URL ?? (isDev ? devApiEndpoint : "https://api.us1.vertesia.io"),
        zeno: import.meta.env.VITE_VERTESIA_ZENO_URL ?? (isDev ? devApiEndpoint : "https://api.us1.vertesia.io"),
        sts: import.meta.env.VITE_VERTESIA_STS_URL ?? (isDev ? "https://sts.dev1.vertesia.io" : "https://sts.us1.vertesia.io"),
    }
};

Env.init(envConfig);
