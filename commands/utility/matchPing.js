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
const matchPingChannel = config.matchPingChannel;
const matchPingCheck = sheetsConfig.matchPingCheckColumn;

const matchMedia = [
    "https://files.catbox.moe/ny528c.gif",
    "https://files.catbox.moe/gprbs4.gif",
    "https://files.catbox.moe/hkdni3.gif",
    "https://files.catbox.moe/ttxqt6.gif",
    "https://files.catbox.moe/vv6pcs.gif",
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

function getRandomMedia() {
    const randomIndex = Math.floor(Math.random() * matchMedia.length);
    return matchMedia[randomIndex];
}

function isVideoUrl(url) {
    return url.endsWith('.mp4') || url.endsWith('.mov') || url.endsWith('.webm');
}

function match_ping(client) {
    const now = new Date();

    return getSpreadsheetData(matchSheet).then(rows => {
        const matchesPinged = [];
        const updatePromises = []
        rows.forEach((row, rowIndex) => {
            const matchTimeUnix = row[columnToIndex(dateColumn)];
            if (!matchTimeUnix) return;

            const alreadyPinged = row[columnToIndex(matchPingCheck)] === "TRUE";
            if (alreadyPinged) return;

            const matchTime = new Date(matchTimeUnix * 1000);

            const timeDifference = (matchTime - now) / (60 * 1000);

            if (timeDifference <= 15 && timeDifference > 0) {
                const captainA = row[columnToIndex(captainAColumn)];
                const captainB = row[columnToIndex(captainBColumn)];
                const matchId = row[columnToIndex(matchIdColumn)];
                const referee = row[columnToIndex(refereeColumn)];
                const streamer = row[columnToIndex(streamerColumn)];
                const comm1 = row[columnToIndex(comm1Column)];
                const comm2 = row[columnToIndex(comm2Column)];

                let content = `## Match Reminder\n`;
                content += `**Captains**: <@${captainA}> <@${captainB}>\n`;

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

                const mediaLink = getRandomMedia();

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

                if (!isVideoUrl(mediaLink)) {
                    embed.setImage(mediaLink);
                }

                sendMatchPingWithMedia(client, content, embed, mediaLink, matchId);

                matchesPinged.push(matchId);

                const rowNumber = rowIndex + 1;
                const range = `${matchSheet}!${matchPingCheck}${rowNumber}:${matchPingCheck}${rowNumber}`;
                const values = [["TRUE"]];

                const updatePromise = updateSpreadsheetData(range, values);
                updatePromises.push(updatePromise);
            }
        });

        return Promise.all(updatePromises).then(() => {
            return matchesPinged;
        });
    }).catch(error => {
        console.error("Error fetching spreadsheet data:", error);
        return [];
    });
}

async function force_match_ping(client, matchId) {
    try {
        const rows = await getSpreadsheetData(matchSheet);
        let matchFound = false;

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const currentMatchId = row[columnToIndex(matchIdColumn)];

            if (currentMatchId === matchId) {
                matchFound = true;
                const rowIndex = i;

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

                const now = new Date();
                const matchTime = new Date(matchTimeUnix * 1000);
                const timeDifference = (matchTime - now) / (60 * 1000);

                let content = `## Match Reminder\n`;
                content += `**Captains**: <@${captainA}> <@${captainB}>\n`;

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

                const mediaLink = getRandomMedia();

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

                if (!isVideoUrl(mediaLink)) {
                    embed.setImage(mediaLink);
                }

                await sendMatchPingWithMedia(client, content, embed, mediaLink, matchId);

                const rowNumber = rowIndex + 2;
                const range = `${matchSheet}!${matchPingCheck}${rowNumber}:${matchPingCheck}${rowNumber}`;
                const values = [["TRUE"]];

                console.log("Updating spreadsheet with:", {
                    range: range,
                    values: values
                });

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

async function sendMatchPingWithMedia(client, content, embed, mediaLink, matchId) {
    const channel = client.channels.cache.get(matchPingChannel);

    if (!channel) {
        console.error(`Match ping channel ${matchPingChannel} not found`);
        return;
    }

    try {
        await channel.send({
            content: content,
            embeds: [embed]
        });

        if (isVideoUrl(mediaLink)) {
            await channel.send(mediaLink);
        }

        console.log(`Match ping sent to channel ${channel.name}`);
    } catch (error) {
        console.error(`Error sending match ping: ${error}`);

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

    match_ping
};
