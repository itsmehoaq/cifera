const {google} = require("googleapis");
const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    SlashCommandBuilder,
} = require("discord.js");
const sheets = require('../../auth.js');
const config = require("../../config.json");
const sheetsConfig = require("../../sheets-config.json");
const dateColumn = sheetsConfig.dateColumn;
const matchSheet = sheetsConfig.sheetName;
const captainAColumn = sheetsConfig.captainAColumn;
const captainBColumn = sheetsConfig.captainBColumn;
const matchIdColumn = sheetsConfig.matchIdColumn;
const refereeColumn = sheetsConfig.refereeColumn;
const streamerColumn = sheetsConfig.streamerColumn;
const comm1Column = sheetsConfig.comm1Column;
const comm2Column = sheetsConfig.comm2Column;
const {getSpreadsheetData, updateSpreadsheetData} = require("../../modules/spreadsheetFunctions.js");
const {columnToIndex} = require("../../modules/columnToIndex.js");

// New constants
const matchPingChannel = sheetsConfig.matchPingChannel;
const matchPingCheck = sheetsConfig.matchPingCheckColumn;

/**
 * Function to handle match pings
 * Pings captains and staff 30 minutes before the match time.
 * @param {Object} client - Discord.js client instance
 */
function match_ping(client) {
    // Get current time
    const now = new Date();

    // Get spreadsheet data
    return getSpreadsheetData().then(rows => {
        const matchesPinged = [];
        const updatePromises = [];

        rows.forEach((row, rowIndex) => {
            // Get match time from the sheet (converting Unix timestamp to Date)
            const matchTimeUnix = row[columnToIndex(dateColumn)];
            if (!matchTimeUnix) return; // Skip if no date is set

            // Check if match has already been pinged
            const alreadyPinged = row[columnToIndex(matchPingCheck)] === "TRUE";
            if (alreadyPinged) return; // Skip if already pinged

            const matchTime = new Date(matchTimeUnix * 1000);

            // Calculate time difference in minutes
            const timeDifference = (matchTime - now) / (60 * 1000);

            // Check if it's 30 minutes or less before the match
            if (timeDifference <= 30 && timeDifference > 0) {
                // Get all relevant IDs
                const captainA = row[columnToIndex(captainAColumn)];
                const captainB = row[columnToIndex(captainBColumn)];
                const matchId = row[columnToIndex(matchIdColumn)];
                const referee = row[columnToIndex(refereeColumn)];
                const streamer = row[columnToIndex(streamerColumn)];
                const comm1 = row[columnToIndex(comm1Column)];
                const comm2 = row[columnToIndex(comm2Column)];

                // Create ping message
                let content = `⏰ **MATCH REMINDER - ${Math.round(timeDifference)} MINUTES** ⏰ \n`;
                content += `Match ID: ${matchId}\n`;

                // Mention captains
                content += `**Captains**: <@${captainA}> vs <@${captainB}>\n`;

                // Add staff mentions if available
                if (referee) {
                    content += `**Referee**: <@${referee}> `;
                }
                if (streamer) {
                    content += `**Streamer**: <@${streamer}> `;
                }
                if (comm1) {
                    content += `**Commentator 1**: <@${comm1}> `;
                }
                if (comm2) {
                    content += `**Commentator 2**: <@${comm2}> `;
                }

                // Create embed
                const embed = new EmbedBuilder()
                    .setColor("#0099ff")
                    .setTitle(`Match ID: ${matchId}`)
                    .addFields(
                        {name: "Match Time", value: `<t:${matchTimeUnix}:f>`, inline: false},
                        {name: "Team 1 Captain", value: `<@${captainA}>`, inline: true},
                        {name: "Team 2 Captain", value: `<@${captainB}>`, inline: true}
                    )
                    .setTimestamp()
                    .setFooter({text: `Match starting in ${Math.round(timeDifference)} minutes.`});

                // Send ping to the designated channel
                sendMatchPing(client, content, embed);

                // Add to list of pinged matches
                matchesPinged.push(matchId);

                // Update the spreadsheet to mark this match as pinged
                // Make sure we're passing the value as an array of arrays for the Google Sheets API
                const updatePromise = updateSpreadsheetData(
                    matchSheet,
                    `${matchPingCheck}${rowIndex + 2}:${matchPingCheck}${rowIndex + 2}`,
                    [["TRUE"]]
                );
                updatePromises.push(updatePromise);
            }
        });

        // Wait for all updates to complete
        return Promise.all(updatePromises).then(() => {
            return matchesPinged;
        });
    }).catch(error => {
        console.error("Error fetching spreadsheet data:", error);
        return [];
    });
}

/**
 * Function to send a ping for a specific match by ID
 * @param {Object} client - Discord.js client instance
 * @param {string} matchId - ID of the match to ping
 */
async function force_match_ping(client, matchId) {
    try {
        const rows = await getSpreadsheetData();
        let matchFound = false;

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const currentMatchId = row[columnToIndex(matchIdColumn)];

            if (currentMatchId === matchId) {
                matchFound = true;

                // Get match details
                const matchTimeUnix = row[columnToIndex(dateColumn)];
                const captainA = row[columnToIndex(captainAColumn)];
                const captainB = row[columnToIndex(captainBColumn)];
                const referee = row[columnToIndex(refereeColumn)];
                const streamer = row[columnToIndex(streamerColumn)];
                const comm1 = row[columnToIndex(comm1Column)];
                const comm2 = row[columnToIndex(comm2Column)];

                if (!matchTimeUnix) {
                    throw new Error("Match has no scheduled time");
                }

                // Calculate time until match
                const now = new Date();
                const matchTime = new Date(matchTimeUnix * 1000);
                const timeDifference = (matchTime - now) / (60 * 1000);

                // Create ping message
                let content = `⚠️ **MATCH ANNOUNCEMENT** ⚠️ \n`;
                content += `Match ID: ${matchId}\n`;

                // Mention captains
                content += `**Captains**: <@${captainA}> vs <@${captainB}>\n`;

                // Add staff mentions if available
                if (referee) {
                    content += `**Referee**: <@${referee}> `;
                }
                if (streamer) {
                    content += `**Streamer**: <@${streamer}> `;
                }
                if (comm1) {
                    content += `**Commentator 1**: <@${comm1}> `;
                }
                if (comm2) {
                    content += `**Commentator 2**: <@${comm2}> `;
                }

                // Create embed
                const embed = new EmbedBuilder()
                    .setColor("#FF9900")
                    .setTitle(`Match ID: ${matchId}`)
                    .addFields(
                        {name: "Match Time", value: `<t:${matchTimeUnix}:f>`, inline: false},
                        {name: "Team 1 Captain", value: `<@${captainA}>`, inline: true},
                        {name: "Team 2 Captain", value: `<@${captainB}>`, inline: true}
                    )
                    .setTimestamp()
                    .setFooter({text: timeDifference > 0
                            ? `Match starting in ${Math.round(timeDifference)} minutes.`
                            : "This match should have already started."});

                // Send ping to the designated channel
                sendMatchPing(client, content, embed);

                // Update the spreadsheet to mark this match as pinged
                // Fix: Make sure we're passing the value as an array of arrays for the Google Sheets API
                await updateSpreadsheetData(
                    matchSheet,
                    `${matchPingCheck}${i + 2}:${matchPingCheck}${i + 2}`,
                    [["TRUE"]]
                );

                return true;
            }
        }

        if (!matchFound) {
            throw new Error(`Match with ID ${matchId} not found`);
        }

    } catch (error) {
        console.error(`Error in force_match_ping: ${error}`);
        throw error;
    }
}

/**
 * Function to send match ping to the designated channel using Discord.js
 * @param {Object} client - Discord.js client instance
 * @param {string} content - Message content
 * @param {Object} embed - Discord embed object
 */
function sendMatchPing(client, content, embed) {
    // Find the channel
    const channel = client.channels.cache.get(matchPingChannel);

    if (channel) {
        // Send the ping message with embed
        channel.send({
            content: content,
            embeds: [embed]
        }).then(() => {
            console.log(`Match ping sent to channel ${channel.name}`);
        }).catch(error => {
            console.error(`Error sending match ping: ${error}`);
        });
    } else {
        console.error(`Match ping channel ${matchPingChannel} not found`);
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("match_ping")
        .setDescription("Commands for match pings")
        .addSubcommand(subcommand =>
            subcommand
                .setName("check")
                .setDescription("Check for matches that are 30 minutes away or less")
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("force")
                .setDescription("Force send a ping for a specific match")
                .addStringOption(option =>
                    option.setName("match_id")
                        .setDescription("ID of the match to ping")
                        .setRequired(true)
                )
        ),

    execute: async (interaction) => {
        // Only allow admins to use this command
        if (!config.admins.includes(interaction.user.id)) {
            return interaction.reply({
                content: "You don't have permission to use this command.",
                ephemeral: true
            });
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === "check") {
            await interaction.reply({
                content: "Checking for matches...",
                ephemeral: true
            });

            // Pass the client instance from the interaction
            const matchesPinged = await match_ping(interaction.client);

            if (matchesPinged.length > 0) {
                await interaction.editReply({
                    content: `Match check completed! Pinged ${matchesPinged.length} match(es): ${matchesPinged.join(", ")}`,
                    ephemeral: true
                });
            } else {
                await interaction.editReply({
                    content: "Match check completed! No matches found that need pinging.",
                    ephemeral: true
                });
            }
        } else if (subcommand === "force") {
            const matchId = interaction.options.getString("match_id");

            await interaction.reply({
                content: `Sending ping for match ${matchId}...`,
                ephemeral: true
            });

            try {
                await force_match_ping(interaction.client, matchId);

                await interaction.editReply({
                    content: `Successfully sent ping for match ${matchId}!`,
                    ephemeral: true
                });
            } catch (error) {
                await interaction.editReply({
                    content: `Error: ${error.message}`,
                    ephemeral: true
                });
            }
        }
    },

    // Export the match_ping function so it can be used in index.js for scheduling
    match_ping
};
