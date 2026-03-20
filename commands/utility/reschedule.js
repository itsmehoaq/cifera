const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
} = require("discord.js");

const config = require("../../config.json");
const sheetsConfig = require("../../sheets-config.json");
const bracketUnixColumn = sheetsConfig.bracketUnixColumn;
const matchSheet = sheetsConfig.sheetName;
const captainAColumn = sheetsConfig.captainAColumn;
const captainBColumn = sheetsConfig.captainBColumn;
const matchIdColumn = sheetsConfig.matchIdColumn;
const refereeColumn = sheetsConfig.refereeColumn;
const streamerColumn = sheetsConfig.streamerColumn;
const comm1Column = sheetsConfig.comm1Column;
const comm2Column = sheetsConfig.comm2Column;
const rescheduleAnnouncementChannel = config.rescheduleAnnouncementChannel;
const {
  getSpreadsheetData,
  updateSpreadsheetData,
} = require("../../modules/spreadsheetFunctions.js");
const { columnToIndex } = require("../../modules/columnToIndex.js");
const { parseAndAdjust } = require("../../modules/dateTimeHelpers.js");

function announceReschedule(embed, interaction, matchRow) {
  const channel = interaction.guild.channels.cache.find(
    (channel) => channel.id === rescheduleAnnouncementChannel,
  );
  embed.setFooter({ text: "Match rescheduled." });
  embed.setTitle(`Match ID: ${matchRow[columnToIndex(matchIdColumn)]}`);
  if (!channel) {
    console.log(`Channel ${rescheduleAnnouncementChannel} not found.`);
  }

  let content = `‼️ **MATCH RESCHEDULED** ‼️ \n`;
  let refereeId = matchRow[columnToIndex(refereeColumn)];
  let streamerId = matchRow[columnToIndex(streamerColumn)];
  let comm1Id = matchRow[columnToIndex(comm1Column)];
  let comm2Id = matchRow[columnToIndex(comm2Column)];

  if (refereeId) {
    content += `<@${refereeId}> `;
  }
  if (streamerId) {
    content += `<@${streamerId}> `;
  }
  if (comm1Id) {
    content += `<@${comm1Id}> `;
  }
  if (comm2Id) {
    content += `<@${comm2Id}> `;
  }
  channel.send({
    content: content,
    embeds: [embed],
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("reschedule")
    .setDescription("Initiates a match reschedule request")
    .addStringOption((option) =>
      option
        .setName("match_id")
        .setDescription("Match ID to reschedule")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("date")
        .setDescription("New date, (DD/MM/YYYY)")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("time")
        .setDescription("New time, (HH:MM)")
        .setRequired(true),
    ),

  execute: async (interaction) => {
    const { options } = interaction;
    const matchID = options.getString("match_id");
    const parsed = parseAndAdjust(
      options.getString("date"),
      options.getString("time"),
      config.timezone,
    );
    if (!parsed) {
      return interaction.reply({
        content:
          "Invalid date or time format. Please use the following format: DD/MM/YYYY HH:MM",
        ephemeral: true,
      });
    }
    const { unixTime: newUnixTime } = parsed;

    const rows = await getSpreadsheetData(matchSheet);
    const matchRow = rows.find(
      (row) => row[columnToIndex(matchIdColumn)] === matchID,
    );
    const matchRowIndex = rows.indexOf(matchRow) + 1;
    if (!matchRow) {
      return interaction.reply({
        content: "Match ID not found.",
        ephemeral: true,
      });
    }
    const userInitiated = interaction.user.id;
    const expectedPlayer1Id = matchRow[columnToIndex(captainAColumn)];
    const expectedPlayer2Id = matchRow[columnToIndex(captainBColumn)];
    if (
      userInitiated !== expectedPlayer1Id &&
      userInitiated !== expectedPlayer2Id &&
      !config.admins.includes(userInitiated)
    ) {
      return interaction.reply({
        content: "You are not authorized to reschedule this match.",
        ephemeral: true,
      });
    }
    let player1Id = userInitiated;
    let player2Id = expectedPlayer2Id;
    if (player1Id === expectedPlayer2Id) player2Id = expectedPlayer1Id;

    const oldUnixTime = parseInt(
      matchRow[columnToIndex(bracketUnixColumn)],
      10,
    );

    const embed = new EmbedBuilder()
      .setColor("#0099ff")
      .setTitle("Match Reschedule Request")
      .addFields(
        {
          name: "Team 1 Captain",
          value: `<@${expectedPlayer1Id}>`,
          inline: true,
        },
        {
          name: "Team 2 Captain",
          value: `<@${expectedPlayer2Id}>`,
          inline: true,
        },
        {
          name: "Old time",
          value: Number.isFinite(oldUnixTime) ? `<t:${oldUnixTime}:f>` : "N/A",
          inline: false,
        },
        {
          name: "New time",
          value: `<t:${Math.floor(newUnixTime)}:f>`,
          inline: false,
        },
      )
      .setTimestamp()
      .setFooter({ text: "Please confirm or deny the reschedule request." });

    const confirmButton = new ButtonBuilder()
      .setCustomId("confirm_reschedule")
      .setLabel("Confirm")
      .setStyle(ButtonStyle.Success);

    const denyButton = new ButtonBuilder()
      .setCustomId("deny_reschedule")
      .setLabel("Deny")
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(confirmButton, denyButton);

    const response = await interaction.reply({
      content: `‼️ **Reschedule Request** ‼️ \n <@${expectedPlayer1Id}>, <@${expectedPlayer2Id}>`,
      embeds: [embed],
      components: [row],
    });

    const collectorFilter = (i) =>
      i.user.id === player2Id || config.admins.includes(i.user.id);
    try {
      const confirmation = await response.awaitMessageComponent({
        filter: collectorFilter,
        time: 300000,
      });
      if (confirmation.customId === "confirm_reschedule") {
        let dateRange = `${matchSheet}!${bracketUnixColumn}${matchRowIndex}`;
        await updateSpreadsheetData(dateRange, [[newUnixTime]]);
        announceReschedule(embed, interaction, matchRow);
        return confirmation.update({
          content: ":white_check_mark: Reschedule request **confirmed**.",
          components: [],
          embeds: [],
        });
      } else if (confirmation.customId === "deny_reschedule") {
        return confirmation.update({
          content: ":x: Reschedule request **denied**.",
          components: [],
          embeds: [],
        });
      }
    } catch (error) {
      return interaction.editReply({
        content: "The reschedule request has timed out.",
        components: [],
        embeds: [],
      });
    }
  },
};
