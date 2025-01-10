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
    return new Promise<ConfigResult | undefined>((resolve) => {
        if (shouldRefreshProfileToken(profile, 10)) {
            console.log("Refreshing auth token for profile:", profile.name);
            updateProfile(profile.name, resolve);
        } else {
            resolve(undefined)
        }
    });
}
