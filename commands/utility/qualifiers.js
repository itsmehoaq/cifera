const {
    SlashCommandBuilder,
} = require('discord.js')
const config = require('../../config.json');
const sheetsConfig = require('../../sheets-config.json');
const qualifiersSheet = sheetsConfig.qualifiersSheetName;
const {getSpreadsheetData, updateSpreadsheetData, appendSpreadsheetData} = require('../../modules/spreadsheetFunctions.js');
const {columnToIndex} = require('../../modules/columnToIndex.js');
const {indexToColumn} = require('../../modules/indexToColumn.js');
const {parseAndAdjust, parseSheetDateTimeToUnix} = require('../../modules/dateTimeHelpers.js');
const qualifiersCaptainDiscordStartingColumn = sheetsConfig.qualifiersCaptainDiscordStartingColumn;
const qualifiersLobbySize = config.qualifiersLobbySize;
const captainRole = config.captainRole;
const qualifiersLobbyIdColumn = sheetsConfig.qualifiersLobbyIdColumn;
const qualifiersDateColumn = sheetsConfig.qualifiersDateColumn;
const qualifiersTimeColumn = sheetsConfig.qualifiersTimeColumn;
const qualifiersCustomLobbyPrefix = sheetsConfig.qualifiersCustomLobbyPrefix;

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

async function checkIfAlreadyInAnotherLobby(rows, userId) {
    for (const row of rows) {
        for (let i = 0; i < qualifiersLobbySize; i++) {
            const captainDiscordId = row[columnToIndex(qualifiersCaptainDiscordStartingColumn) + i];
            if (captainDiscordId === userId) {
                const lobbyRowIndex = rows.indexOf(row) + 1;
                const columnFound = indexToColumn(columnToIndex(qualifiersCaptainDiscordStartingColumn) + i);
                const range = `'${qualifiersSheet}'!${columnFound}${lobbyRowIndex}:${columnFound}${lobbyRowIndex}`;
                await updateSpreadsheetData(range, [['']]);
                return true;
            }
        }
    }
    return false;
}

function generateNextLobbyId(rows) {
    const prefix = qualifiersCustomLobbyPrefix;
    let maxNum = 0;
    for (const row of rows) {
        const id = row[columnToIndex(qualifiersLobbyIdColumn)];
        if (id && id.toUpperCase().startsWith(prefix.toUpperCase())) {
            const numPart = parseInt(id.slice(prefix.length));
            if (!isNaN(numPart) && numPart > maxNum) {
                maxNum = numPart;
            }
        }
    }
    return `${prefix}${maxNum + 1}`;
}

async function handlePresetLobbyJoin(rows, interaction, lobbyRow, lobbyRowIndex) {
    if (checkIfAlreadyInLobby(lobbyRow, interaction.user.id)) {
        return interaction.editReply({
            content: `:x: You are already in this lobby.`,
            ephemeral: true,
        });
    }

    let columnFound = '';
    let lobbyFound = false;
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

    let replyContent = '';
    if (await checkIfAlreadyInAnotherLobby(rows, interaction.user.id)) {
        replyContent = `:warning: You have been removed from your previous lobby.\n`;
    }

    try {
        const range = `'${qualifiersSheet}'!${columnFound}${lobbyRowIndex}:${columnFound}${lobbyRowIndex}`;
        await updateSpreadsheetData(range, [[interaction.user.id]]);

        const lobbyId = lobbyRow[columnToIndex(qualifiersLobbyIdColumn)];
        const existingDateStr = lobbyRow[columnToIndex(qualifiersDateColumn)];
        const existingTimeStr = lobbyRow[columnToIndex(qualifiersTimeColumn)];
        const existingUnix = parseSheetDateTimeToUnix(existingDateStr, existingTimeStr);

        if (existingUnix) {
            replyContent += `:white_check_mark: You have joined lobby **${lobbyId.toUpperCase()}** scheduled at <t:${Math.floor(existingUnix)}:f>.`;
        } else {
            replyContent += `:white_check_mark: You have joined lobby **${lobbyId.toUpperCase()}**.`;
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

async function handleCustomLobbyCreate(rows, interaction, parsed) {
    let replyContent = '';
    if (await checkIfAlreadyInAnotherLobby(rows, interaction.user.id)) {
        replyContent = `:warning: You have been removed from your previous lobby.\n`;
    }

    try {
        const newLobbyId = generateNextLobbyId(rows);

        const captainColIndex = columnToIndex(qualifiersCaptainDiscordStartingColumn);
        const lobbyIdIndex = columnToIndex(qualifiersLobbyIdColumn);
        const dateColIndex = columnToIndex(qualifiersDateColumn);
        const timeColIndex = columnToIndex(qualifiersTimeColumn);

        const rowLength = Math.max(captainColIndex + 1, lobbyIdIndex + 1, dateColIndex + 1, timeColIndex + 1);
        const newRow = new Array(rowLength).fill('');
        newRow[lobbyIdIndex] = newLobbyId;
        newRow[dateColIndex] = parsed.dateStr;
        newRow[timeColIndex] = parsed.timeStr;
        newRow[captainColIndex] = interaction.user.id;

        await appendSpreadsheetData(qualifiersSheet, [newRow]);

        replyContent += `:white_check_mark: Custom lobby **${newLobbyId}** created and scheduled at <t:${Math.floor(parsed.unixTime)}:f>.`;
        interaction.editReply({ content: replyContent, ephemeral: true });
    } catch (error) {
        console.error(error);
        interaction.editReply({
            content: `${replyContent}:x: An error occurred while creating the lobby.`,
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
        updateSpreadsheetData(range, [['']])
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
                .setDescription('Join a preset lobby by ID, or create a custom lobby with a date and time')
                .addStringOption(option =>
                    option
                        .setName('lobbyid')
                        .setDescription('Preset lobby ID (leave empty to create a custom lobby)')
                        .setRequired(false)
                )
                .addStringOption(option =>
                    option
                        .setName('date')
                        .setDescription('Custom lobby date (DD/MM/YYYY) — only for custom lobbies')
                        .setRequired(false)
                )
                .addStringOption(option =>
                    option
                        .setName('time')
                        .setDescription('Custom lobby time (HH:MM) — only for custom lobbies')
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

        if (!checkValidUser(interaction)) {
            return interaction.editReply({
                content: ':x: You are not authorized to use this command.',
                ephemeral: true,
            });
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'join') {
            const lobbyIdInput = interaction.options.getString('lobbyid');
            const dateInput = interaction.options.getString('date');
            const timeInput = interaction.options.getString('time');

            const hasLobbyId = !!lobbyIdInput;
            const hasDateTime = !!(dateInput || timeInput);

            if (hasLobbyId && hasDateTime) {
                return interaction.editReply({
                    content: ':x: Provide either a **Lobby ID** (to join a preset lobby) or a **date and time** (to create a custom lobby), not both.',
                    ephemeral: true,
                });
            }

            if (!hasLobbyId && !hasDateTime) {
                return interaction.editReply({
                    content: ':x: Please provide a **Lobby ID** to join a preset lobby, or a **date and time** to create a custom lobby.',
                    ephemeral: true,
                });
            }

            const rows = await getSpreadsheetData(qualifiersSheet);

            if (hasLobbyId) {
                const lobbyId = lobbyIdInput.toUpperCase();
                const lobbyRow = rows.find((row) => row[columnToIndex(qualifiersLobbyIdColumn)] === lobbyId);
                if (!lobbyRow) {
                    return interaction.editReply({
                        content: ':x: Lobby ID not found.',
                        ephemeral: true,
                    });
                }
                const lobbyRowIndex = rows.indexOf(lobbyRow) + 1;
                await handlePresetLobbyJoin(rows, interaction, lobbyRow, lobbyRowIndex);
            } else {
                if (!dateInput || !timeInput) {
                    return interaction.editReply({
                        content: ':x: Please provide **both** a date and a time to create a custom lobby.',
                        ephemeral: true,
                    });
                }
                const parsed = parseAndAdjust(dateInput, timeInput, config.timezone);
                if (!parsed) {
                    return interaction.editReply({
                        content: ':x: Invalid date or time. Use DD/MM/YYYY and HH:MM, and ensure the date is in the future.',
                        ephemeral: true,
                    });
                }
                await handleCustomLobbyCreate(rows, interaction, parsed);
            }
        } else {
            const lobbyId = interaction.options.getString('lobbyid').toUpperCase();
            const rows = await getSpreadsheetData(qualifiersSheet);
            const lobbyRow = rows.find((row) => row[columnToIndex(qualifiersLobbyIdColumn)] === lobbyId);
            if (!lobbyRow) {
                return interaction.editReply({
                    content: ':x: Lobby ID not found.',
                    ephemeral: true,
                });
            }
            const lobbyRowIndex = rows.indexOf(lobbyRow) + 1;
            handleQualifiersLeave(interaction, lobbyRow, lobbyRowIndex);
        }
    }
}
