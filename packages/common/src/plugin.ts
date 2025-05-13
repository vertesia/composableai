/**
 * A vertesia plugin manifest
 */
export interface PluginManifest {
    id: string;
    src: string;
    name: string;
    version: string;
    publisher: string;
    title?: string;
    description?: string;
    icon?: string;
}
