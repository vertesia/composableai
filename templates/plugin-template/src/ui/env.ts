import { Env } from "@vertesia/ui/env";

const CONFIG__PLUGIN_TITLE = "Ui Plugin Template";

document.title = CONFIG__PLUGIN_TITLE;

Env.init({
    name: CONFIG__PLUGIN_TITLE,
    version: "1.0.0",
    isLocalDev: true,
    isDocker: true,
    type: "development",
    devAuthToken: import.meta.env.DEV ? import.meta.env.VITE_VERTESIA_AUTH_TOKEN : undefined,
    endpoints: {
        studio: "https://api.us1.vertesia.io",
        zeno: "https://api.us1.vertesia.io",
        sts: "https://sts.us1.vertesia.io",
    }
});
