/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_APP_NAME: string;
    readonly VITE_STUDIO_URL?: string;
    readonly VITE_ZENO_URL?: string;
    readonly VITE_STS_URL?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
