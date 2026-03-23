import { Env } from "@vertesia/ui/env";

const CONFIG__PLUGIN_TITLE = "Ui Plugin Template";

Env.init({
    name: CONFIG__PLUGIN_TITLE,
    version: "1.0.0",
    isLocalDev: true,
    isDocker: true,
    type: "development",
    endpoints: {
        studio: "https://api.us1.vertesia.io",
        zeno: "https://api.us1.vertesia.io",
        sts: "https://sts.us1.vertesia.io",
    }
});
