import { Interaction, InteractionRef, InteractionStatus } from "@vertesia/common";
import colors from "ansi-colors";
import { Command } from "commander";
import { getClient } from "../client.js";
import { textToPascalCase } from "../codegen/utils.js";

export async function listInteractions(program: Command, interactionId: string | undefined, options: Record<string, any>) {
    const client = await getClient(program);
    if (!interactionId) {
        const interactions = await client.interactions.list();
        interactions.map(interaction => {
            console.log(textToPascalCase(interaction.name) + ` [${interaction.id}]`);
        });
        return;
    }
    const interaction = await client.interactions.retrieve(interactionId);
    if (interaction.status === InteractionStatus.draft) {
        const versions = await client.interactions.listVersions(interactionId);
        printInteraction(interaction, versions, options);
    } else {
        printInteraction(interaction, [], options);
    }
}


function printInteraction(interaction: Interaction, versions: InteractionRef[], _options: Record<string, any>) {
    console.log(colors.bold(interaction.name) + " [" + interaction.id + "]");
    console.log(colors.bold("Description:"), interaction.description || 'n/a');
    console.log(colors.bold("Class name:"), textToPascalCase(interaction.name));
    console.log(colors.bold("Status:"), interaction.status);
    console.log(colors.bold("Version:"), interaction.version);
    console.log(colors.bold("Tags:"), interaction.tags && interaction.tags.length > 0 ? interaction.tags.join(", ") : "n/a");
    if (interaction.status === InteractionStatus.draft) {
        versions.sort((a, b) => a.version - b.version);
        console.log(colors.bold("Published Versions:"), versions.length > 0 ? versions.map(v => v.version).join(", ") : "n/a");
    }
}
