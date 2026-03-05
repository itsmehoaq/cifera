const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    SlashCommandBuilder,
} = require("discord.js");
const config = require("../../config.json");
const sheetsConfig = require('../../sheets-config.json');

const matchSheet = sheetsConfig.sheetName;
const matchIdColumn = sheetsConfig.matchIdColumn;
const refereeColumn = sheetsConfig.refereeColumn;
const streamerColumn = sheetsConfig.streamerColumn;
const comm1Column = sheetsConfig.comm1Column;
const comm2Column = sheetsConfig.comm2Column;

const qualifiersSheet = sheetsConfig.qualifiersSheetName;
const qualifiersLobbyIdColumn = sheetsConfig.qualifiersLobbyIdColumn;
const qualifiersRefereeColumn = sheetsConfig.qualifiersRefereeColumn;

const { getSpreadsheetData, updateSpreadsheetData } = require('../../modules/spreadsheetFunctions.js');
const { columnToIndex } = require('../../modules/columnToIndex.js');

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
            } else if (!comm2) {
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
            } else if (comm2 === interaction.user.id) {
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

async function handleQualifiersClaimCommand(interaction, lobbyRow, lobbyRowIndex) {
    const matchId = interaction.options.getString('matchid').toUpperCase();
    const refIndex = columnToIndex(qualifiersRefereeColumn);
    const currentReferee = lobbyRow[refIndex];

    const range = `'${qualifiersSheet}'!${qualifiersRefereeColumn}${lobbyRowIndex}:${qualifiersRefereeColumn}${lobbyRowIndex}`;

    if (!currentReferee) {
        await updateSpreadsheetData(range, [[interaction.user.id]]);
        return interaction.editReply({
            content: `:white_check_mark: Lobby **${matchId}** claimed as **Referee** by <@${interaction.user.id}>.`,
        });
    }

    if (currentReferee === interaction.user.id) {
        return interaction.editReply({
            content: `:x: You have already claimed lobby **${matchId}** as **Referee**.`,
            ephemeral: true,
        });
    }

    const confirmButton = new ButtonBuilder()
        .setCustomId('quals_ref_replace_yes')
        .setLabel('Yes, replace me')
        .setStyle(ButtonStyle.Danger);

    const denyButton = new ButtonBuilder()
        .setCustomId('quals_ref_replace_no')
        .setLabel('No, keep me')
        .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(confirmButton, denyButton);

    const prompt = await interaction.editReply({
        content: `<@${currentReferee}>, <@${interaction.user.id}> wants to take your **Referee** slot for lobby **${matchId}**. Do you agree to be replaced?`,
        components: [row],
    });

    const filter = (i) => i.user.id === currentReferee;

    try {
        const buttonInteraction = await prompt.awaitMessageComponent({ filter, time: 30_000 });

        if (buttonInteraction.customId === 'quals_ref_replace_yes') {
            await updateSpreadsheetData(range, [[interaction.user.id]]);
            await buttonInteraction.update({
                content: `:white_check_mark: <@${currentReferee}> agreed. Lobby **${matchId}** is now claimed as **Referee** by <@${interaction.user.id}>.`,
                components: [],
            });
        } else {
            await buttonInteraction.update({
                content: `:x: <@${currentReferee}> declined. Lobby **${matchId}** referee remains <@${currentReferee}>.`,
                components: [],
            });
        }
    } catch {
        // Timed out — disable buttons
        await interaction.editReply({
            content: `:x: No response from <@${currentReferee}>. Lobby **${matchId}** referee remains <@${currentReferee}>.`,
            components: [],
        });
    }
}

async function handleQualifiersDropCommand(interaction, lobbyRow, lobbyRowIndex) {
    const matchId = interaction.options.getString('matchid').toUpperCase();
    const refIndex = columnToIndex(qualifiersRefereeColumn);
    const currentReferee = lobbyRow[refIndex];

    if (!currentReferee) {
        return interaction.editReply({
            content: `:x: Lobby **${matchId}** has no Referee claimed.`,
            ephemeral: true,
        });
    }

    if (currentReferee !== interaction.user.id) {
        return interaction.editReply({
            content: `:x: Lobby **${matchId}** Referee is <@${currentReferee}>, not you.`,
            ephemeral: true,
        });
    }

    const range = `'${qualifiersSheet}'!${qualifiersRefereeColumn}${lobbyRowIndex}:${qualifiersRefereeColumn}${lobbyRowIndex}`;
    await updateSpreadsheetData(range, [['' ]]);
    return interaction.editReply({
        content: `:white_check_mark: Lobby **${matchId}** dropped as **Referee** by <@${interaction.user.id}>.`,
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('staff')
        .setDescription("Manage matches.")
        .addSubcommand(subcommand =>
            subcommand
                .setName('claim')
                .setDescription("Claim a match.")
                .addStringOption(option =>
                    option
                        .setName('matchid')
                        .setDescription('ID of the match or qualifier lobby to claim.')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('position')
                        .setRequired(true)
                        .setDescription('Position to claim.')
                        .addChoices(
                            { name: 'Referee', value: 'Referee' },
                            { name: 'Streamer', value: 'Streamer' },
                            { name: 'Commentator', value: 'Commentator' },
                        )
                )
                .addStringOption(option =>
                    option
                        .setName('type')
                        .setRequired(false)
                        .setDescription('Match type (default: bracket).')
                        .addChoices(
                            { name: 'Bracket', value: 'bracket' },
                            { name: 'Qualifiers', value: 'qualifiers' },
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('drop')
                .setDescription("Drop a match.")
                .addStringOption(option =>
                    option
                        .setName('matchid')
                        .setDescription('ID of the match or qualifier lobby to drop.')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('position')
                        .setDescription('Position to drop.')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Referee', value: 'Referee' },
                            { name: 'Streamer', value: 'Streamer' },
                            { name: 'Commentator', value: 'Commentator' },
                        )
                )
                .addStringOption(option =>
                    option
                        .setName('type')
                        .setRequired(false)
                        .setDescription('Match type (default: bracket).')
                        .addChoices(
                            { name: 'Bracket', value: 'bracket' },
                            { name: 'Qualifiers', value: 'qualifiers' },
                        )
                )
        ),

    execute: async (interaction) => {
        await interaction.deferReply();

        const type = interaction.options.getString('type') ?? 'bracket';
        const position = interaction.options.getString('position');
        const subcommand = interaction.options.getSubcommand();
        const matchId = interaction.options.getString('matchid');

        if (type === 'qualifiers' && position !== 'Referee') {
            return interaction.editReply({
                content: `:x: Qualifiers only supports the **Referee** position.`,
                ephemeral: true,
            });
        }

        if (!checkValidUser(interaction)) {
            return interaction.editReply({
                content: `:x: You are not authorized to use this command. (Missing **${position}** role)`,
                ephemeral: true,
            });
        }

        if (type === 'qualifiers') {
            const rows = await getSpreadsheetData(qualifiersSheet);
            const lobbyRow = rows.find((row) => row[columnToIndex(qualifiersLobbyIdColumn)]?.toUpperCase() === matchId.toUpperCase());
            if (!lobbyRow) {
                return interaction.editReply({
                    content: `:x: Qualifier lobby **${matchId.toUpperCase()}** not found.`,
                    ephemeral: true,
                });
            }
            const lobbyRowIndex = rows.indexOf(lobbyRow) + 1;

            if (subcommand === 'claim') {
                return handleQualifiersClaimCommand(interaction, lobbyRow, lobbyRowIndex);
            } else {
                return handleQualifiersDropCommand(interaction, lobbyRow, lobbyRowIndex);
            }
        } else {
            const rows = await getSpreadsheetData(matchSheet);
            const matchRow = rows.find((row) => row[columnToIndex(matchIdColumn)] === matchId);
            if (!matchRow) {
                return interaction.editReply({
                    content: `:x: Match ID **${matchId}** not found.`,
                    ephemeral: true,
                });
            }
            const matchRowIndex = rows.indexOf(matchRow) + 1;

            if (subcommand === 'claim') {
                return handleClaimCommand(interaction, matchRow, matchRowIndex);
            } else {
                return handleDropCommand(interaction, matchRow, matchRowIndex);
            }
        }
    }
}
