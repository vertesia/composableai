import enquirer from "enquirer";
import { createProfile, updateProfile } from "../profiles/commands.js";
import { config, shouldRefreshProfileToken } from "../profiles/index.js";
import { ConfigResult } from "../profiles/server/index.js";
import { WorkerProject } from "./project.js";
import { updateNpmrc } from "./registry.js";

const { prompt } = enquirer;

interface ConnectOptions {
    nonInteractive?: boolean;
    profile?: string;
}
export async function connectToProject(options: ConnectOptions) {
    const allowInteraction = !options.nonInteractive;
    const project = new WorkerProject();
    const pkg = project.packageJson;
    let profileName: string | undefined = options.profile || pkg.vertesia.profile;
    const onAuthenticationDone = async (result: ConfigResult | undefined) => {
        if (result) {
            await updateNpmrc(project, result.profile);
        }
    }
    try {
        if (allowInteraction && !profileName) {
            profileName = await askProfileName();
            if (!profileName) {
                // create a new profile
                profileName = await createProfile(undefined, { onResult: onAuthenticationDone });
            }
        }
        if (!profileName) {
            console.log('Profile not specified. When using --non-interactive mode you may want to specify a profile');
            process.exit(1);
        }
        const profile = config.getProfile(profileName);
        if (!profile) {
            console.log('Profile not found:', profileName);
            process.exit(1);
        }
        if (allowInteraction && shouldRefreshProfileToken(profile, 10)) {
            console.log("Refreshing auth token for profile:", profileName);
            await updateProfile(profileName, onAuthenticationDone);
        } else {
            await updateNpmrc(project, profileName);
        }
    } finally {
        if (pkg.vertesia.profile !== profileName) {
            // save package.json
            pkg.vertesia.profile = profileName;
            pkg.save();
        }
    }
}

async function askProfileName() {
    const profiles = config.profiles.map(p => p.name);
    if (profiles.length > 0) {
        const newProfile = 'Create new profile';
        profiles.push(newProfile);
        const answer: Record<string, any> = await prompt({
            name: 'profile',
            type: 'select',
            message: "Select a profile to use when connecting.",
            initial: profiles.length - 1,
            choices: profiles,
        });
        if (newProfile !== answer.profile) {
            return answer.profile; // use existing
        }
    }
    return undefined; // create new profile
}