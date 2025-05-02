import { useEffect, useInsertionEffect, useState } from "react";
import { HostContext } from "./HostContext.js";
import { usePluginModule } from "./PluginManager.js";
import { createSharedContext } from "./host.js";

export function PluginHost({ pluginId, slot, context }: { pluginId: string, slot: string, context: HostContext }) {
    const [contextCreated, setContextCreated] = useState(false);
    useEffect(() => {
        createSharedContext(context);
        setContextCreated(true);
    }, []);
    return contextCreated && <_PluginHost pluginId={pluginId} slot={slot} />
}

function _PluginHost({ pluginId, slot }: { pluginId: string, slot: string }) {
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
        return module.mount(slot)
    } else {
        return <div>Loading ...</div>
    }

}