const google = require('googleapis');
const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    SlashCommandBuilder,
} = require("discord.js");
const sheets = require('../../auth.js');
const config = require("../../config.json");
const sheetsConfig = require('../../sheets-config.json');
const matchIdColumn = sheetsConfig.matchIdColumn;
const refereeColumn = sheetsConfig.refereeColumn;
const streamerColumn = sheetsConfig.streamerColumn;
const comm1Column = sheetsConfig.comm1Column;
const comm2Column = sheetsConfig.comm2Column;
const {getSpreadsheetData, updateSpreadsheetData} = require('../../modules/spreadsheetFunctions.js');
const {columnToIndex} = require('../../modules/columnToIndex.js');

function checkValidUser(interaction) {
    switch (interaction.options.getString('position')) {
        case 'Referee':
            return interaction.member.roles.cache.has(config.whitelistRole.Referee);
        case 'Streamer':
            return interaction.member.roles.cache.has(config.whitelistRole.Streamer);
        case 'Commentator':
            return interaction.member.roles.cache.has(config.whitelistRole.Commentator);
    }
}

async function handleClaimCommand(interaction, matchRow, matchRowIndex) {
    const position = interaction.options.getString('position');
    let range = '';
    let value;
    let targetColumn;

    switch (position) {
        case 'Referee':
        case 'Streamer':
            targetColumn = position === 'Referee' ? refereeColumn : streamerColumn;
            const targetIndex = columnToIndex(targetColumn);
            console.log(matchRow[targetIndex]);
            if (matchRow[targetIndex]) {
                return interaction.editReply({
                    content: `:x: Match ${interaction.options.getString('matchid')}, **${position}** already claimed by <@${matchRow[targetIndex]}>.`,
                    ephemeral: true,
                });
            }
            range = `'${sheetsConfig.sheetName}'!${targetColumn}${matchRowIndex}:${targetColumn}${matchRowIndex}`;
            value = [[interaction.user.id]]
            break;
        case 'Commentator':
            const comm1Index = columnToIndex(comm1Column);
            const comm2Index = columnToIndex(comm2Column);
            const comm1 = matchRow[comm1Index];
            const comm2 = matchRow[comm2Index];
            if ((comm1 && comm2) || (comm1 === interaction.user.id) || (comm2 === interaction.user.id)) {
                return interaction.editReply({
                    content: `:x: Match ${interaction.options.getString('matchid')}, Commentators already claimed by <@${comm1}> and <@${comm2}>.`,
                    ephemeral: true,
                });
            }
            if (!comm1) {
                targetColumn = comm1Column;
            }
            else if (!comm2) {
                targetColumn = comm2Column;
            }
            range = `'${sheetsConfig.sheetName}'!${targetColumn}${matchRowIndex}:${targetColumn}${matchRowIndex}`;
            value = [[interaction.user.id]]
            break;
    }
    await updateSpreadsheetData(range, value);
    return interaction.editReply({
        content: `:white_check_mark: Match ${interaction.options.getString('matchid')} claimed as **${position}** by <@${interaction.user.id}>.`
    });
}

async function handleDropCommand(interaction, matchRow, matchRowIndex) {
    const position = interaction.options.getString('position');
    let range = '';
    let value;
    let targetColumn;

    switch (position) {
        case 'Referee':
        case 'Streamer':
            targetColumn = position === 'Referee' ? refereeColumn : streamerColumn;
            const targetIndex = columnToIndex(targetColumn);
            if (!matchRow[targetIndex] === interaction.user.id) {
                return interaction.editReply({
                    content: `:x: Match ${interaction.options.getString('matchid')}, **${position}** not claimed.`,
                    ephemeral: true,
                });
            }
            range = `'${sheetsConfig.sheetName}'!${targetColumn}${matchRowIndex}:${targetColumn}${matchRowIndex}`;
            value = [['']]
            break;
        case 'Commentator':
            const comm1Index = columnToIndex(comm1Column);
            const comm2Index = columnToIndex(comm2Column);
            const comm1 = matchRow[comm1Index];
            const comm2 = matchRow[comm2Index];
            if (!comm1 && !comm2) {
                return interaction.editReply({
                    content: `:x: Match ${interaction.options.getString('matchid')}, Commentators not claimed.`,
                    ephemeral: true,
                });
            }
            if (comm1 === interaction.user.id) {
                targetColumn = comm1Column;
            }
            else if (comm2 === interaction.user.id) {
                targetColumn = comm2Column;
            } else {
                return interaction.editReply({
                    content: `:x: Match ${interaction.options.getString('matchid')}, Commentator not claimed.`,
                    ephemeral: true,
                });
            }
            range = `'${sheetsConfig.sheetName}'!${targetColumn}${matchRowIndex}:${targetColumn}${matchRowIndex}`;
            value = [['']]
            break;
    }
    await updateSpreadsheetData(range, value);
    return interaction.editReply({
        content: `:white_check_mark: Match ${interaction.options.getString('matchid')} dropped as **${position}** by <@${interaction.user.id}>.`
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('match')
        .setDescription("Manage matches.")
        .addSubcommand(subcommand =>
            subcommand
                .setName('claim')
                .setDescription("Claim a match.")
                .addStringOption(option =>
                    option
                        .setName('matchid')
                        .setDescription('ID of the match to claim.')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('position')
                        .setRequired(true)
                        .setDescription('Position to claim.')
                        .addChoices({name: 'Referee', value: 'Referee'}, {
                            name: 'Streamer',
                            value: 'Streamer'
                        }, {name: 'Commentator', value: 'Commentator'})
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('drop')
                .setDescription("Drop a match.")
                .addStringOption(option =>
                    option
                        .setName('matchid')
                        .setDescription('ID of the match to drop.')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('position')
                        .setDescription('Position to drop.')
                        .setRequired(true)
                        .addChoices({name: 'Referee', value: 'Referee'}, {
                            name: 'Streamer',
                            value: 'Streamer'
                        }, {name: 'Commentator', value: 'Commentator'})
                )
        ),
    execute: async (interaction) => {
        interaction.deferReply();
        let rows = await getSpreadsheetData();
        if (!checkValidUser(interaction)) {
            return interaction.editReply({
                content: `:x: You are not authorized to use this command. (Missing **${interaction.options.getString('position')}** role)`,
                ephemeral: true,
            });
        }
        const matchId = interaction.options.getString('matchid');
        const matchRow = rows.find((row) => row[columnToIndex(matchIdColumn)] === matchId);
        if (!matchRow) {
            return interaction.editReply({
                content: `:x: Match ID **${matchId}** not found.`,
                ephemeral: true,
            });
        }
        const matchRowIndex = rows.indexOf(matchRow) + 1;
        switch (interaction.options.getSubcommand()) {
            case 'claim':
                handleClaimCommand(interaction, matchRow, matchRowIndex);
                break;
            case 'drop':
                handleDropCommand(interaction, matchRow, matchRowIndex);
                break;
        }
    }
}
