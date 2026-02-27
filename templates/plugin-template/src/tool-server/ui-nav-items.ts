import { AppUINavItem } from "@vertesia/common";

/**
 * Optional App UI Navigation configuration
 * Used to configure the optional navigation subitems that you want to display within the Composite App sidebar
 * Icons can be any of the icons from https://lucide.dev/icons, or an SVG element as a string
 * Route is the subpath to navigate to when the item is clicked, relative to the plugin's base URL
 * If your plugin does not have a UI, or you do not want to add additional navigation items, you can set this to an empty array
 * Note: this does not create the actual UI routes -- it is a map of existing routes you wish to expose as subitems in the Composite App.
 */
export default [
    { label: "Home Page", icon: "Star", route: "/" },
    { label: "Next Page", icon: "Square", route: "/next" },
] satisfies AppUINavItem[];
