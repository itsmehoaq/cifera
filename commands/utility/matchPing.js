const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const config = require("../../config.json");
const sheetsConfig = require("../../sheets-config.json");
const {
  getSpreadsheetData,
  updateSpreadsheetData,
} = require("../../modules/spreadsheetFunctions.js");
const { columnToIndex } = require("../../modules/columnToIndex.js");
const {
  parseSheetDateTimeToUnix,
} = require("../../modules/dateTimeHelpers.js");

const matchSheet = sheetsConfig.sheetName;
const bracketUnixColumn = sheetsConfig.bracketUnixColumn;
const captainAColumn = sheetsConfig.captainAColumn;
const captainBColumn = sheetsConfig.captainBColumn;
const matchIdColumn = sheetsConfig.matchIdColumn;
const refereeColumn = sheetsConfig.refereeColumn;
const streamerColumn = sheetsConfig.streamerColumn;
const comm1Column = sheetsConfig.comm1Column;
const comm2Column = sheetsConfig.comm2Column;
const matchPingCheck = sheetsConfig.matchPingCheckColumn;

const qualifiersSheet = sheetsConfig.qualifiersSheetName;
const qualifiersLobbyIdColumn = sheetsConfig.qualifiersLobbyIdColumn;
const qualifiersDateColumn = sheetsConfig.qualifiersDateColumn;
const qualifiersTimeColumn = sheetsConfig.qualifiersTimeColumn;
const qualifiersCaptainStart =
  sheetsConfig.qualifiersCaptainDiscordStartingColumn;
const qualifiersRefereeColumn = sheetsConfig.qualifiersRefereeColumn;
const qualifiersPingCheck = sheetsConfig.qualifiersPingCheckColumn;
const qualifiersLobbySize = parseInt(config.qualifiersLobbySize);

const matchPingChannel = config.matchPingChannel;

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
  "https://files.catbox.moe/jc1h42.mp4",
];

function getRandomMedia() {
  return matchMedia[Math.floor(Math.random() * matchMedia.length)];
}

function isVideoUrl(url) {
  return url.endsWith(".mp4") || url.endsWith(".mov") || url.endsWith(".webm");
}

async function sendMatchPingWithMedia(
  client,
  content,
  embed,
  mediaLink,
  label,
) {
  const channel = client.channels.cache.get(matchPingChannel);
  if (!channel) {
    console.error(`Match ping channel ${matchPingChannel} not found`);
    return;
  }
  try {
    await channel.send({ content, embeds: [embed] });
    if (isVideoUrl(mediaLink)) await channel.send(mediaLink);
    console.log(`Ping sent for ${label} to #${channel.name}`);
  } catch (error) {
    console.error(`Error sending ping: ${error}`);
    try {
      await channel.send({
        content: content + "\n*(Note: Media failed to load)*",
        embeds: [embed],
      });
    } catch (fallbackError) {
      console.error(`Fallback ping also failed: ${fallbackError}`);
    }
  }
}

function match_ping(client) {
  const now = new Date();

  return getSpreadsheetData(matchSheet)
    .then((rows) => {
      const matchesPinged = [];
      const updatePromises = [];

      rows.forEach((row, rowIndex) => {
        const matchTimeUnix = row[columnToIndex(bracketUnixColumn)];
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
          if (referee) content += `\n**Referee**: <@${referee}>`;
          if (streamer) content += `\n**Streamer**: <@${streamer}>`;
          if (comm1) content += `\n**Commentator**: <@${comm1}>`;
          if (comm2) content += ` <@${comm2}>`;

          const mediaLink = getRandomMedia();
          const embed = new EmbedBuilder()
            .setColor("#0099ff")
            .setTitle(`Match ID: ${matchId}`)
            .addFields(
              {
                name: "Match Time",
                value: `<t:${matchTimeUnix}:f>`,
                inline: false,
              },
              { name: "Team 1 Captain", value: `<@${captainA}>`, inline: true },
              { name: "Team 2 Captain", value: `<@${captainB}>`, inline: true },
            )
            .setTimestamp()
            .setFooter({
              text: `Match starting in ${Math.round(timeDifference)} minutes.`,
            });

          if (!isVideoUrl(mediaLink)) embed.setImage(mediaLink);

          sendMatchPingWithMedia(client, content, embed, mediaLink, matchId);
          matchesPinged.push(matchId);

          const rowNumber = rowIndex + 1;
          const range = `${matchSheet}!${matchPingCheck}${rowNumber}:${matchPingCheck}${rowNumber}`;
          updatePromises.push(updateSpreadsheetData(range, [["TRUE"]]));
        }
      });

      return Promise.all(updatePromises).then(() => matchesPinged);
    })
    .catch((error) => {
      console.error("Error fetching bracket spreadsheet data:", error);
      return [];
    });
}

function qualifiers_ping(client) {
  const now = new Date();

  return getSpreadsheetData(qualifiersSheet)
    .then((rows) => {
      const lobbiesPinged = [];
      const updatePromises = [];

      rows.forEach((row, rowIndex) => {
        const dateStr = row[columnToIndex(qualifiersDateColumn)];
        const timeStr = row[columnToIndex(qualifiersTimeColumn)];
        if (!dateStr || !timeStr) return;

        const alreadyPinged =
          row[columnToIndex(qualifiersPingCheck)] === "TRUE";
        if (alreadyPinged) return;

        const lobbyTimeUnix = parseSheetDateTimeToUnix(
          dateStr,
          timeStr,
          config.timezone,
        );
        if (!lobbyTimeUnix) return;

        const lobbyTime = new Date(lobbyTimeUnix * 1000);
        const timeDifference = (lobbyTime - now) / (60 * 1000);

        if (timeDifference <= 15 && timeDifference > 0) {
          const lobbyId = row[columnToIndex(qualifiersLobbyIdColumn)];
          const referee = row[columnToIndex(qualifiersRefereeColumn)];

          const captainIds = [];
          for (let i = 0; i < qualifiersLobbySize; i++) {
            const id = row[columnToIndex(qualifiersCaptainStart) + i];
            if (id) captainIds.push(id);
          }

          let content = `## Qualifier Lobby Reminder\n`;
          content += `**Captains**: ${captainIds.map((id) => `<@${id}>`).join(" ")}\n`;
          if (referee) content += `\n**Referee**: <@${referee}>`;

          const mediaLink = getRandomMedia();
          const captainFieldValue =
            captainIds.length > 0
              ? captainIds.map((id) => `<@${id}>`).join("\n")
              : "*No captains yet*";

          const embed = new EmbedBuilder()
            .setColor("#0099ff")
            .setTitle(`Qualifier Lobby: ${lobbyId}`)
            .addFields(
              {
                name: "Lobby Time",
                value: `<t:${Math.floor(lobbyTimeUnix)}:f>`,
                inline: false,
              },
              {
                name: `Captains (${captainIds.length})`,
                value: captainFieldValue,
                inline: false,
              },
            )
            .setTimestamp()
            .setFooter({
              text: `Lobby starting in ${Math.round(timeDifference)} minutes.`,
            });

          if (!isVideoUrl(mediaLink)) embed.setImage(mediaLink);

          sendMatchPingWithMedia(client, content, embed, mediaLink, lobbyId);
          lobbiesPinged.push(lobbyId);

          const rowNumber = rowIndex + 1;
          const range = `'${qualifiersSheet}'!${qualifiersPingCheck}${rowNumber}:${qualifiersPingCheck}${rowNumber}`;
          updatePromises.push(updateSpreadsheetData(range, [["TRUE"]]));
        }
      });

      return Promise.all(updatePromises).then(() => lobbiesPinged);
    })
    .catch((error) => {
      console.error("Error fetching qualifiers spreadsheet data:", error);
      return [];
    });
}

async function force_match_ping(client, matchId) {
  try {
    const rows = await getSpreadsheetData(matchSheet);
    let matchFound = false;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row[columnToIndex(matchIdColumn)] !== matchId) continue;

      matchFound = true;
      const matchTimeUnix = row[columnToIndex(bracketUnixColumn)];
      const captainA = row[columnToIndex(captainAColumn)];
      const captainB = row[columnToIndex(captainBColumn)];
      const referee = row[columnToIndex(refereeColumn)];
      const streamer = row[columnToIndex(streamerColumn)];
      const comm1 = row[columnToIndex(comm1Column)];
      const comm2 = row[columnToIndex(comm2Column)];

      if (!matchTimeUnix) throw new Error("Match has no scheduled time");

      const now = new Date();
      const matchTime = new Date(matchTimeUnix * 1000);
      const timeDifference = (matchTime - now) / (60 * 1000);

      let content = `## Match Reminder\n`;
      content += `**Captains**: <@${captainA}> <@${captainB}>\n`;
      if (referee) content += `\n**Referee**: <@${referee}>`;
      if (streamer) content += `\n**Streamer**: <@${streamer}>`;
      if (comm1) content += `\n**Commentator**: <@${comm1}>`;
      if (comm2) content += ` <@${comm2}>`;

      const mediaLink = getRandomMedia();
      const embed = new EmbedBuilder()
        .setColor("#FF9900")
        .setTitle(`Match ID: ${matchId}`)
        .addFields(
          {
            name: "Match Time",
            value: `<t:${matchTimeUnix}:f>`,
            inline: false,
          },
          { name: "Team 1 Captain", value: `<@${captainA}>`, inline: true },
          { name: "Team 2 Captain", value: `<@${captainB}>`, inline: true },
        )
        .setTimestamp()
        .setFooter({
          text:
            timeDifference > 0
              ? `Match starting in ${Math.round(timeDifference)} minutes.`
              : "This match should have already started.",
        });

      if (!isVideoUrl(mediaLink)) embed.setImage(mediaLink);

      await sendMatchPingWithMedia(client, content, embed, mediaLink, matchId);

      const rowNumber = i + 2;
      const range = `${matchSheet}!${matchPingCheck}${rowNumber}:${matchPingCheck}${rowNumber}`;
      console.log("Updating spreadsheet with:", { range, values: [["TRUE"]] });
      await updateSpreadsheetData(range, [["TRUE"]]);

      return true;
    }

    if (!matchFound) throw new Error(`Match with ID ${matchId} not found`);
  } catch (error) {
    console.error(`Error in force_match_ping: ${error}`);
    throw error;
  }
}

async function force_qualifiers_ping(client, lobbyId) {
  try {
    const rows = await getSpreadsheetData(qualifiersSheet);
    let found = false;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (
        row[columnToIndex(qualifiersLobbyIdColumn)]?.toUpperCase() !==
        lobbyId.toUpperCase()
      )
        continue;

      found = true;
      const dateStr = row[columnToIndex(qualifiersDateColumn)];
      const timeStr = row[columnToIndex(qualifiersTimeColumn)];
      const referee = row[columnToIndex(qualifiersRefereeColumn)];

      if (!dateStr || !timeStr) throw new Error("Lobby has no scheduled time");

      const lobbyTimeUnix = parseSheetDateTimeToUnix(
        dateStr,
        timeStr,
        config.timezone,
      );
      if (!lobbyTimeUnix) throw new Error("Could not parse lobby date/time");

      const now = new Date();
      const lobbyTime = new Date(lobbyTimeUnix * 1000);
      const timeDifference = (lobbyTime - now) / (60 * 1000);

      const captainIds = [];
      for (let j = 0; j < qualifiersLobbySize; j++) {
        const id = row[columnToIndex(qualifiersCaptainStart) + j];
        if (id) captainIds.push(id);
      }

      let content = `## Qualifier Lobby Reminder\n`;
      content += `**Captains**: ${captainIds.map((id) => `<@${id}>`).join(" ")}\n`;
      if (referee) content += `\n**Referee**: <@${referee}>`;

      const captainFieldValue =
        captainIds.length > 0
          ? captainIds.map((id) => `<@${id}>`).join("\n")
          : "*No captains yet*";

      const mediaLink = getRandomMedia();
      const embed = new EmbedBuilder()
        .setColor("#FF9900")
        .setTitle(`Qualifier Lobby: ${lobbyId.toUpperCase()}`)
        .addFields(
          {
            name: "Lobby Time",
            value: `<t:${Math.floor(lobbyTimeUnix)}:f>`,
            inline: false,
          },
          {
            name: `Captains (${captainIds.length})`,
            value: captainFieldValue,
            inline: false,
          },
        )
        .setTimestamp()
        .setFooter({
          text:
            timeDifference > 0
              ? `Lobby starting in ${Math.round(timeDifference)} minutes.`
              : "This lobby should have already started.",
        });

      if (!isVideoUrl(mediaLink)) embed.setImage(mediaLink);

      await sendMatchPingWithMedia(client, content, embed, mediaLink, lobbyId);

      const rowNumber = i + 2;
      const range = `'${qualifiersSheet}'!${qualifiersPingCheck}${rowNumber}:${qualifiersPingCheck}${rowNumber}`;
      await updateSpreadsheetData(range, [["TRUE"]]);

      return true;
    }

    if (!found) throw new Error(`Qualifier lobby ${lobbyId} not found`);
  } catch (error) {
    console.error(`Error in force_qualifiers_ping: ${error}`);
    throw error;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("match_ping")
    .setDescription("Commands for match pings")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("check")
        .setDescription(
          "Check for matches/lobbies that are 15 minutes away or less",
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("force")
        .setDescription(
          "Force send a ping for a specific match or qualifier lobby",
        )
        .addStringOption((option) =>
          option
            .setName("match_id")
            .setDescription("ID of the match or qualifier lobby to ping")
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName("type")
            .setDescription("Match type (default: bracket)")
            .setRequired(false)
            .addChoices(
              { name: "Bracket", value: "bracket" },
              { name: "Qualifiers", value: "qualifiers" },
            ),
        ),
    ),

  execute: async (interaction) => {
    if (!config.admins.includes(interaction.user.id)) {
      return interaction.reply({
        content: "You don't have permission to use this command.",
        ephemeral: true,
      });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "check") {
      await interaction.reply({
        content: "Checking for matches and qualifier lobbies...",
        ephemeral: true,
      });

      const [bracketPinged, qualifiersPinged] = await Promise.all([
        match_ping(interaction.client),
        qualifiers_ping(interaction.client),
      ]);

      const total = bracketPinged.length + qualifiersPinged.length;
      if (total > 0) {
        const parts = [];
        if (bracketPinged.length > 0)
          parts.push(`Bracket: ${bracketPinged.join(", ")}`);
        if (qualifiersPinged.length > 0)
          parts.push(`Qualifiers: ${qualifiersPinged.join(", ")}`);
        await interaction.editReply({
          content: `Check completed! Pinged ${total} match(es):\n${parts.join("\n")}`,
          ephemeral: true,
        });
      } else {
        await interaction.editReply({
          content:
            "Check completed! No matches or lobbies found that need pinging.",
          ephemeral: true,
        });
      }
    } else if (subcommand === "force") {
      const matchId = interaction.options.getString("match_id");
      const type = interaction.options.getString("type") ?? "bracket";

      await interaction.reply({
        content: `Sending ping for ${type === "qualifiers" ? "qualifier lobby" : "match"} **${matchId}**...`,
        ephemeral: true,
      });

      try {
        if (type === "qualifiers") {
          await force_qualifiers_ping(interaction.client, matchId);
        } else {
          await force_match_ping(interaction.client, matchId);
        }
        await interaction.editReply({
          content: `Successfully sent ping for **${matchId}**!`,
          ephemeral: true,
        });
      } catch (error) {
        await interaction.editReply({
          content: `Error: ${error.message}`,
          ephemeral: true,
        });
      }
    }
  },

  match_ping,
  qualifiers_ping,
};
