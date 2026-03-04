const {
    SlashCommandBuilder,
} = require('discord.js')
const config = require('../../config.json');
const sheetsConfig = require('../../sheets-config.json');
const qualifiersSheet = sheetsConfig.qualifiersSheetName;
const {getSpreadsheetData, updateSpreadsheetData} = require('../../modules/spreadsheetFunctions.js');
const {columnToIndex} = require('../../modules/columnToIndex.js');
const {indexToColumn} = require('../../modules/indexToColumn.js');
const {parseAndAdjust} = require('../../modules/dateTimeHelpers.js');
const qualifiersCaptainDiscordStartingColumn = sheetsConfig.qualifiersCaptainDiscordStartingColumn;
const qualifiersLobbySize = config.qualifiersLobbySize;
const captainRole = config.captainRole;
const qualifiersLobbyIdColumn = sheetsConfig.qualifiersLobbyIdColumn;
const qualifiersDateColumn = sheetsConfig.qualifiersDateColumn;
const qualifiersTimeColumn = sheetsConfig.qualifiersTimeColumn;

function checkValidUser(interaction) {
    return interaction.member.roles.cache.has(captainRole);
}

function checkIfAlreadyInLobby(lobbyRow, userId) {
    for (let i = 0; i < qualifiersLobbySize; i++) {
        const captainDiscordId = lobbyRow[columnToIndex(qualifiersCaptainDiscordStartingColumn) + i];
        if (captainDiscordId === userId) {
            return true;
        }
    }
    return false;
}

async function checkIfAlreadyInAnotherLobby(interaction, rows, userId) {
    for (const row of rows) {
        for (let i = 0; i < qualifiersLobbySize; i++) {
            const captainDiscordId = row[columnToIndex(qualifiersCaptainDiscordStartingColumn) + i];
            if (captainDiscordId === userId) {
                //leave lobby
                const lobbyId = row[columnToIndex(qualifiersLobbyIdColumn)];
                const lobbyRowIndex = rows.indexOf(row) + 1;
                const columnFound = indexToColumn(columnToIndex(qualifiersCaptainDiscordStartingColumn) + i);
                const range = `'${qualifiersSheet}'!${columnFound}${lobbyRowIndex}:${columnFound}${lobbyRowIndex}`;
                const value = [['']];
                await updateSpreadsheetData(range, value)
                return true;
            }
        }
    }
    return false;
}

async function handleQualifiersJoin(rows, interaction, lobbyRow, lobbyRowIndex, parsed = null) {
    let lobbyFound = false;
    let columnFound = '';
    if (checkIfAlreadyInLobby(lobbyRow, interaction.user.id)) {
        return interaction.editReply({
            content: `:x: You are already in this lobby.`,
            ephemeral: true,
        });
    }
    for (let i = 0; i < qualifiersLobbySize; i++) {
        const captainDiscordId = lobbyRow[columnToIndex(qualifiersCaptainDiscordStartingColumn) + i];
        if (!captainDiscordId) {
            columnFound = indexToColumn(columnToIndex(qualifiersCaptainDiscordStartingColumn) + i);
            lobbyFound = true;
            break;
        }
    }
    if (!lobbyFound) {
        return interaction.editReply({
            content: `:x: Lobby is full.`,
            ephemeral: true,
        });
    }

    let replyContent = ``;
    if (await checkIfAlreadyInAnotherLobby(interaction, rows, interaction.user.id)) {
        replyContent = `:warning: You have been removed from your previous lobby.\n`;
    }

    try {
        const range = `'${qualifiersSheet}'!${columnFound}${lobbyRowIndex}:${columnFound}${lobbyRowIndex}`;
        await updateSpreadsheetData(range, [[interaction.user.id]]);

        if (parsed && qualifiersDateColumn && qualifiersTimeColumn) {
            const dateRange = `'${qualifiersSheet}'!${qualifiersDateColumn}${lobbyRowIndex}:${qualifiersTimeColumn}${lobbyRowIndex}`;
            await updateSpreadsheetData(dateRange, [[parsed.dateStr, parsed.timeStr]]);
            replyContent += `:white_check_mark: You have joined the lobby **${interaction.options.getString('lobbyid').toUpperCase()}** scheduled at <t:${Math.floor(parsed.unixTime)}:f>.`;
        } else {
            replyContent += `:white_check_mark: You have joined the lobby **${interaction.options.getString('lobbyid').toUpperCase()}**.`;
        }
        interaction.editReply({ content: replyContent, ephemeral: true });
    } catch (error) {
        console.error(error);
        interaction.editReply({
            content: `${replyContent}:x: An error occurred while updating the spreadsheet.`,
            ephemeral: true,
        });
    }
}

function handleQualifiersLeave(interaction, lobbyRow, lobbyRowIndex) {
    let lobbyFound = false;
    let columnFound = '';
    for (let i = 0; i < qualifiersLobbySize; i++) {
        const captainDiscordId = lobbyRow[columnToIndex(qualifiersCaptainDiscordStartingColumn) + i];
        if (captainDiscordId === interaction.user.id) {
            lobbyRow[columnToIndex(qualifiersCaptainDiscordStartingColumn) + i] = '';
            columnFound = indexToColumn(columnToIndex(qualifiersCaptainDiscordStartingColumn) + i);
            lobbyFound = true;
            break;
        }
    }
    if (!lobbyFound) {
        return interaction.editReply({
            content: `:x: You are not in this lobby.`,
            ephemeral: true,
        });
    } else {
        const range = `'${qualifiersSheet}'!${columnFound}${lobbyRowIndex}:${columnFound}${lobbyRowIndex}`;
        const value = [['']];
        updateSpreadsheetData(range, value)
            .then(() => {
                interaction.editReply({
                    content: `:white_check_mark: You have left the lobby **${interaction.options.getString('lobbyid').toUpperCase()}**.`,
                    ephemeral: true,
                });
            })
            .catch((error) => {
                console.error(error);
                interaction.editReply({
                    content: `:x: An error occurred while updating the spreadsheet.`,
                    ephemeral: true,
                });
            });
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('qualifiers')
        .setDescription("Join/Leave Qualifiers' lobbies")
        .addSubcommand(subcommand =>
            subcommand
                .setName('join')
                .setDescription('Join a lobby')
                .addStringOption(option =>
                    option
                        .setName('lobbyid')
                        .setDescription('Lobby ID')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('date')
                        .setDescription('Lobby date (DD/MM/YYYY) — optional')
                        .setRequired(false)
                )
                .addStringOption(option =>
                    option
                        .setName('time')
                        .setDescription('Lobby time (HH:MM) — optional')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('leave')
                .setDescription('Leave a lobby')
                .addStringOption(option =>
                    option
                        .setName('lobbyid')
                        .setDescription('Lobby ID')
                        .setRequired(true)
                )
        ),
    execute: async (interaction) => {
        await interaction.deferReply();
        const lobbyId = interaction.options.getString('lobbyid').toUpperCase();
        if (!checkValidUser(interaction)) {
            return interaction.editReply({
                content: ':x: You are not authorized to use this command.',
                ephemeral: true,
            });
        }
        const rows = await getSpreadsheetData(qualifiersSheet);
        const lobbyRow = rows.find((row) => row[columnToIndex(qualifiersLobbyIdColumn)] === lobbyId);
        if (!lobbyRow) {
            return interaction.editReply({
                content: ':x: Lobby ID not found.',
                ephemeral: true,
            });
        }
        const lobbyRowIndex = rows.indexOf(lobbyRow) + 1;
        if (interaction.options.getSubcommand() === 'join') {
            const dateInput = interaction.options.getString('date');
            const timeInput = interaction.options.getString('time');
            let parsed = null;

            if (dateInput || timeInput) {
                if (!dateInput || !timeInput) {
                    return interaction.editReply({
                        content: ':x: Please provide **both** a date and a time.',
                        ephemeral: true,
                    });
                }
                parsed = parseAndAdjust(dateInput, timeInput, config.timezone);
                if (!parsed) {
                    return interaction.editReply({
                        content: ':x: Invalid date or time. Use DD/MM/YYYY and HH:MM, and ensure the date is in the future.',
                        ephemeral: true,
                    });
                }
            }

            await handleQualifiersJoin(rows, interaction, lobbyRow, lobbyRowIndex, parsed);
        } else {
            handleQualifiersLeave(interaction, lobbyRow, lobbyRowIndex);
        }
    }
}

