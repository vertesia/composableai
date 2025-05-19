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
    /**
     * Whether the plugin should be loaded as part of the host layout
     * or in a new tab.
     * If external is true, the plugin must manage itself the global layout of the page.
     * It will be loaded in a new tab.
     * If external is false the plugin will be loaded as a page of the host application and it will share the same layout.
     * Default is false.
     */
    external?: boolean;
    /**
     * The default is "beta".
     */
    status?: "beta" | "stable" | "deprecated" | "hidden";
}
