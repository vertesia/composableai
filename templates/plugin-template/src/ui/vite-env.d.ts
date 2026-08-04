/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_APP_NAME: string;
    /** The immutable app version id this bundle was built for (set by the appgen version build). */
    readonly VITE_APP_VERSION?: string;
    readonly VITE_VERTESIA_STUDIO_URL?: string;
    readonly VITE_VERTESIA_ZENO_URL?: string;
    readonly VITE_VERTESIA_STS_URL?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
