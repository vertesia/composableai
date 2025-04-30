import { useInsertionEffect } from "react";
import { MountContext } from "./slots.js";
import { usePluginModule } from "./PluginManager.js";


export function PluginHost({ pluginId, context }: { pluginId: string, context: MountContext }) {
    const { plugin, module, error } = usePluginModule(pluginId);
    useInsertionEffect(() => {
        if (module) {
            plugin!.install();
        }
    }, [module]);

    if (!plugin) {
        return <div>Plugin {pluginId} not found</div>
    } else if (error) {
        return <div>Failed to load plugin {plugin.manifest.name} from {plugin.manifest.src}: {error.message}</div>
    } else if (module) {
        return module.mount(context)
    } else {
        return <div>Loading ...</div>
    }

}