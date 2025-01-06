import { Interaction, InteractionRef, InteractionStatus } from "@vertesia/common";
import colors from "ansi-colors";
import { Command } from "commander";
import { getClient } from "../client.js";
import { textToPascalCase } from "../codegen/utils.js";

export function listInteractions(program: Command, interactionId: string | undefined, options: Record<string, any>) {
    const client = getClient(program);
    if (!interactionId) {
        return client.interactions.list().then((interactions) => {
            interactions.map(interaction => {
                console.log(textToPascalCase(interaction.name) + ` [${interaction.id}]`);
            });
        });
    }
    return client.interactions.retrieve(interactionId).then((interaction) => {
        if (interaction.status === InteractionStatus.draft) {
            client.interactions.listVersions(interactionId).then((versions) => {
                printInteraction(interaction, versions, options);
            });
        } else {
            printInteraction(interaction, [], options);
        }
    });
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
