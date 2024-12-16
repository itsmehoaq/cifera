let config = require("../../config.json");
const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    SlashCommandBuilder,
} = require("discord.js");
const fs = require("fs");
const path = require("path");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('whitelist')
        .setDescription("Whitelist a role to use the bots staff commands.")
        .addStringOption(option =>
            option
                .setName('rolename')
                .setDescription('Name of the role to whitelist.')
                .setRequired(true)
                .addChoices(
                    {name:'Referee', value:'Referee'}, {name:'Streamer', value:'Streamer'}, {name:'Commentator', value:'Commentator'}
                )
        )
        .addRoleOption(option =>
            option
                .setName('role')
                .setDescription('Role to whitelist.')
                .setRequired(true)
        ),
    execute:
        async (interaction) => {

            if (!config.admins.includes(interaction.user.id)) {
                return interaction.reply({
                    content: ":x: You are not authorized to use this command.",
                    ephemeral: true,
                });
            }
            let roleName = interaction.options.getString('rolename');
            let role = interaction.options.getRole('role');
            config.whitelistRole[roleName] = role.id;
            try {
                fs.writeFileSync(path.join(__dirname, "../../config.json"), JSON.stringify(config, null, 4));
                return interaction.reply({
                    content: `:white_check_mark: Role **${roleName}** has been whitelisted.`,
                    ephemeral: true,
                });
            } catch (error) {
                console.error(error);
                return interaction.reply({
                    content: `:x: An error occurred while writing to the config file.`,
                    ephemeral: true,
                });
            }
        }
}