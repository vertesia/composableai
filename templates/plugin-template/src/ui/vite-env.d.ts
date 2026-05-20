/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_APP_NAME: string;
    readonly VITE_VERTESIA_STUDIO_URL?: string;
    readonly VITE_VERTESIA_ZENO_URL?: string;
    readonly VITE_VERTESIA_STS_URL?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
