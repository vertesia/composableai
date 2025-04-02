import { updateProfile } from "../profiles/commands.js";
import { config, Profile, shouldRefreshProfileToken } from "../profiles/index.js";
import { ConfigResult } from "../profiles/server/index.js";
import { AgentProject } from "./project.js";

export function tryRrefreshProjectToken(project: AgentProject): Promise<ConfigResult | undefined> {
    const profileName = project.packageJson.vertesia?.profile;
    if (!profileName) {
        console.error('No vertesia.profile entry found in package.json');
        process.exit(1);
    }
    const profile = config.getProfile(profileName);
    if (!profile) {
        console.error('No such profile exists: ' + profileName);
        process.exit(1);
    }
    return tryRrefreshToken(profile);
}

export function tryRrefreshToken(profile: Profile): Promise<ConfigResult | undefined> {
    // Create abort controller for cancellation
    const abortController = new AbortController();
    
    // Set up signal handler
    const handleSignal = () => {
        abortController.abort();
        console.log("\nToken refresh interrupted");
        process.exit(0);
    };
    
    // Register signal handlers
    process.on('SIGINT', handleSignal);
    process.on('SIGTERM', handleSignal);
    
    return new Promise<ConfigResult | undefined>((resolve) => {
        // If token doesn't need refresh, resolve immediately
        if (!shouldRefreshProfileToken(profile, 10)) {
            process.off('SIGINT', handleSignal);
            process.off('SIGTERM', handleSignal);
            resolve(undefined);
            return;
        }
        
        console.log("Refreshing auth token for profile:", profile.name);
        
        // Create a callback that cleans up signal handlers
        const wrappedResolve = (result: ConfigResult | undefined) => {
            process.off('SIGINT', handleSignal);
            process.off('SIGTERM', handleSignal);
            resolve(result);
        };
        
        // Start the update with our wrapped resolver
        updateProfile(profile.name, wrappedResolve, abortController.signal);
    });
}
