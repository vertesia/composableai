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
        studio: "https://studio-server-dev-preview.api.dev1.vertesia.io",
        zeno: "https://zeno-server-dev-preview.api.dev1.vertesia.io",
        sts: "https://sts.dev1.vertesia.io",
    }
});
