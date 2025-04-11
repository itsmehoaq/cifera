const {google} = require("googleapis");
const {
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
const matchPingChannel = sheetsConfig.matchPingChannel;
const matchPingCheck = sheetsConfig.matchPingCheckColumn;

// Array of media links for match pings (mix of GIFs and videos)
const matchMedia = [
    // GIFs
    "https://files.catbox.moe/ny528c.gif",
    "https://files.catbox.moe/gprbs4.gif",
    "https://files.catbox.moe/hkdni3.gif",
    "https://files.catbox.moe/ttxqt6.gif",
    "https://files.catbox.moe/vv6pcs.gif",

    // mp4
    "https://files.catbox.moe/s7erg6.mp4",
    "https://files.catbox.moe/g1d4ns.mp4",
    "https://files.catbox.moe/7pu966.mp4",
    "https://files.catbox.moe/dl8wu7.mp4",
    "https://files.catbox.moe/th0ftw.mp4",
    "https://files.catbox.moe/ljumku.mp4",
    "https://files.catbox.moe/h2wvns.mp4",
    "https://files.catbox.moe/rjryqo.mp4",
    "https://files.catbox.moe/jc1h42.mp4"
];

/**
 * Get a random media link from the matchMedia array
 * @returns {string} A random media URL
 */
function getRandomMedia() {
    const randomIndex = Math.floor(Math.random() * matchMedia.length);
    return matchMedia[randomIndex];
}

/**
 * Check if the URL is a video file
 * @param {string} url - The URL to check
 * @returns {boolean} True if it's a video file
 */
function isVideoUrl(url) {
    return url.endsWith('.mp4') || url.endsWith('.mov') || url.endsWith('.webm');
}

/**
 * Function to handle match pings
 * Pings captains and staff before the match time.
 * @param {Object} client - Discord.js client instance
 */
function match_ping(client) {
    // Get current time
    const now = new Date();

    // Get spreadsheet data
    return getSpreadsheetData(matchSheet).then(rows => {
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

            // Check if it's 15 minutes or less before the match
            if (timeDifference <= 15 && timeDifference > 0) {
                // Get all relevant IDs
                const captainA = row[columnToIndex(captainAColumn)];
                const captainB = row[columnToIndex(captainBColumn)];
                const matchId = row[columnToIndex(matchIdColumn)];
                const referee = row[columnToIndex(refereeColumn)];
                const streamer = row[columnToIndex(streamerColumn)];
                const comm1 = row[columnToIndex(comm1Column)];
                const comm2 = row[columnToIndex(comm2Column)];

                // Create ping message
                let content = `## Match Reminder\n`;

                // Mention captains
                content += `**Captains**: <@${captainA}> <@${captainB}>\n`;

                // Add staff mentions if available
                if (referee) {
                    content += `\n**Referee**: <@${referee}>`;
                }
                if (streamer) {
                    content += `\n**Streamer**: <@${streamer}>`;
                }
                if (comm1) {
                    content += `\n**Commentator**: <@${comm1}>`;
                }
                if (comm2) {
                    content += ` <@${comm2}>`;
                }

                // Get a random media link
                const mediaLink = getRandomMedia();

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

                // For GIFs, use the embed's setImage
                if (!isVideoUrl(mediaLink)) {
                    embed.setImage(mediaLink);
                }

                // Send ping to the designated channel
                sendMatchPingWithMedia(client, content, embed, mediaLink, matchId);

                // Add to list of pinged matches
                matchesPinged.push(matchId);

                // Update the spreadsheet to mark this match as pinged
                // The row index in the sheet is rowIndex + 2 (accounting for header row and 0-indexing)
                const rowNumber = rowIndex + 2;

                // Create the range and values in the format expected by the API
                const range = `${matchSheet}!${matchPingCheck}${rowNumber}:${matchPingCheck}${rowNumber}`;
                const values = [["TRUE"]]; // Values as a 2D array

                // Call updateSpreadsheetData with the correct format
                const updatePromise = updateSpreadsheetData(range, values);
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
        const rows = await getSpreadsheetData(matchSheet);
        let matchFound = false;

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const currentMatchId = row[columnToIndex(matchIdColumn)];

            if (currentMatchId === matchId) {
                matchFound = true;
                const rowIndex = i; // Store the row index for later use

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
                let content = `## Match Reminder\n`;

                // Mention captains
                content += `**Captains**: <@${captainA}> <@${captainB}>\n`;

                // Add staff mentions if available
                if (referee) {
                    content += `\n**Referee**: <@${referee}>`;
                }
                if (streamer) {
                    content += `\n**Streamer**: <@${streamer}>`;
                }
                if (comm1) {
                    content += `\n**Commentator**: <@${comm1}>`;
                }
                if (comm2) {
                    content += ` <@${comm2}>`;
                }

                // Get a random media link
                const mediaLink = getRandomMedia();

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
                    .setFooter({
                        text: timeDifference > 0
                            ? `Match starting in ${Math.round(timeDifference)} minutes.`
                            : "This match should have already started."
                    });

                // For GIFs, use the embed's setImage
                if (!isVideoUrl(mediaLink)) {
                    embed.setImage(mediaLink);
                }

                // Send ping to the designated channel
                await sendMatchPingWithMedia(client, content, embed, mediaLink, matchId);

                // Update the spreadsheet to mark this match as pinged
                // The row index in the sheet is rowIndex + 2 (accounting for header row and 0-indexing)
                const rowNumber = rowIndex + 2;

                // Create the range and values in the format expected by the API
                const range = `${matchSheet}!${matchPingCheck}${rowNumber}:${matchPingCheck}${rowNumber}`;
                const values = [["TRUE"]]; // Values as a 2D array

                console.log("Updating spreadsheet with:", {
                    range: range,
                    values: values
                });

                // Call updateSpreadsheetData with the correct format
                await updateSpreadsheetData(range, values);

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
 * Function to send match ping with media handling
 * @param {Object} client - Discord.js client instance
 * @param {string} content - Message content
 * @param {Object} embed - Discord embed object
 * @param {string} mediaLink - Link to media file
 * @param {string} matchId - Match ID for reference
 */
async function sendMatchPingWithMedia(client, content, embed, mediaLink, matchId) {
    // Find the channel
    const channel = client.channels.cache.get(matchPingChannel);

    if (!channel) {
        console.error(`Match ping channel ${matchPingChannel} not found`);
        return;
    }

    try {
        // First, send the main message with embed
        await channel.send({
            content: content,
            embeds: [embed]
        });

        // If it's a video, send it as a separate message with just the URL
        // This ensures it embeds properly without showing in the main message
        if (isVideoUrl(mediaLink)) {
            await channel.send(mediaLink);
        }

        console.log(`Match ping sent to channel ${channel.name}`);
    } catch (error) {
        console.error(`Error sending match ping: ${error}`);

        // If there's an error, try sending just the content without the media
        try {
            await channel.send({
                content: content + "\n*(Note: Media failed to load)*",
                embeds: [embed]
            });
            console.log(`Fallback match ping sent to channel ${channel.name}`);
        } catch (fallbackError) {
            console.error(`Error sending fallback match ping: ${fallbackError}`);
        }
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("match_ping")
        .setDescription("Commands for match pings")
        .addSubcommand(subcommand =>
            subcommand
                .setName("check")
                .setDescription("Check for matches that are 15 minutes away or less")
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
