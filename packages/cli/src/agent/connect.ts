import { Command } from "commander";
import enquirer from "enquirer";
import { createProfile, updateProfile } from "../profiles/commands.js";
import { config, shouldRefreshProfileToken } from "../profiles/index.js";
import { ConfigResult } from "../profiles/server/index.js";
import { AgentProject } from "./project.js";
import { createOrUpdateNpmRegistry } from "./registry.js";

const { prompt } = enquirer;

export async function connectToProject(program: Command) {
    const project = new AgentProject();
    const pkg = project.packageJson;
    let profileName: string | undefined = pkg.vertesia.profile;
    const updateNpmrc = async (profile: string) => {
        config.use(profile);
        await createOrUpdateNpmRegistry(program, project.npmrcFile);
    }
    const onAuthenticationDone = async (result: ConfigResult) => {
        await updateNpmrc(result.profile);
    }
    try {
        if (!profileName) {
            profileName = await askProfileName();
            if (!profileName) {
                // create a new profile
                profileName = await createProfile(undefined, undefined, onAuthenticationDone);
            }
        }
        const profile = config.getProfile(profileName);
        if (!profile) {
            console.log('Profile not found:', profileName);
            process.exit(1);
        }
        if (shouldRefreshProfileToken(profile, 10)) {
            console.log("Refreshing auth token for profile:", profileName);
            await updateProfile(profileName, onAuthenticationDone);
        } else {
            await updateNpmrc(profileName);
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