import enquirer from "enquirer";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
//import { createProfile } from "../profiles/commands.js";
import { Command } from "commander";
import { join, resolve } from "node:path";
import { createProfile, updateProfile } from "../profiles/commands.js";
import { config, shouldRefreshProfileToken } from "../profiles/index.js";
import { createOrUpdateNpmRegistry } from "./registry.js";
import { ConfigResult } from "../profiles/server/index.js";

const { prompt } = enquirer;

export async function connectToProject(program: Command, pkgDir: string) {
    if (!pkgDir) {
        pkgDir = process.cwd();
    }
    pkgDir = resolve(pkgDir);
    if (!existsSync(pkgDir)) {
        console.log('Directory not found:', pkgDir);
        process.exit(1);
    }
    const pkgFile = join(pkgDir, 'package.json');
    if (!existsSync(pkgFile)) {
        console.log('package.json not found at', pkgFile);
        process.exit(1);
    }
    const npmrcFile = join(pkgDir, '.npmrc');

    const pkgContent = readFileSync(pkgFile, 'utf8');
    const pkg = JSON.parse(pkgContent);
    if (!pkg.vertesia) {
        pkg.vertesia = {} as Record<string, any>;
    }
    let profileName: string | undefined = pkg.vertesia.profile;
    const onAuthenticationDone = async (result: ConfigResult) => {
        config.use(result.profile);
        await createOrUpdateNpmRegistry(program, npmrcFile);
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
        }
    } finally {
        if (pkg.vertesia.profile !== profileName) {
            // save package.json
            pkg.vertesia.profile = profileName;
            writeFileSync(pkgFile, JSON.stringify(pkg, null, 2), 'utf8');
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