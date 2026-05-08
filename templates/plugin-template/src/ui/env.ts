import { Env } from "@vertesia/ui/env";

const CONFIG__PLUGIN_TITLE = "Ui Plugin Template";

document.title = CONFIG__PLUGIN_TITLE;

Env.init({
    name: CONFIG__PLUGIN_TITLE,
    version: "1.0.0",
    isLocalDev: true,
    isDocker: true,
    type: "development",
    endpoints: {
        studio: import.meta.env.VITE_STUDIO_URL ?? "https://api.vertesia.io",
        zeno: import.meta.env.VITE_ZENO_URL ?? "https://api.vertesia.io",
        sts: import.meta.env.VITE_STS_URL ?? "https://sts.vertesia.io",
    }
});
