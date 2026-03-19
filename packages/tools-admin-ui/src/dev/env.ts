import { Env } from "@vertesia/ui/env";

Env.init({
    name: "Tools Admin UI",
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
