const { google } = require("googleapis");
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");

async function accessSpreadsheet(auth) {
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = process.env.SPREADSHEET_ID;
  const range = "Sheet1!A1:D5";

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  return response.data.values;
}

module.exports = {
  name: "reschedule",
  description: "Initiates a match reschedule request",
  execute: async (message, args, auth) => {
    if (args.length < 3) {
      return message.reply(
        "Please provide the match ID, new date, and time in the format: !reschedule matchID dd/mm/yyyy hh:mm"
      );
    }

    const [matchID, date, time] = args;
    const newDateTime = `${date} ${time}`;

    const rows = await accessSpreadsheet(auth);

    const matchRow = rows.find((row) => row[0] === matchID);
    if (!matchRow) {
      return message.reply("Match ID not found.");
    }

    const player1Id = message.author.id;
    const player2Id = matchRow[2];
    const expectedPlayer1Id = matchRow[1];

    if (player1Id !== expectedPlayer1Id) {
      return message.reply(
        "You are not authorized to reschedule this match. Your ID does not match the registered Player 1 ID."
      );
    }

    const oldDateTime = `${matchRow[3]} ${matchRow[4]}`;

    const embed = new EmbedBuilder()
      .setColor("#0099ff")
      .setTitle("Match Reschedule Request")
      .addFields(
        { name: "Player 1", value: `<@${player1Id}>`, inline: true },
        { name: "Player 2", value: `<@${player2Id}>`, inline: true },
        { name: "Old time", value: oldDateTime, inline: false },
        { name: "New time", value: newDateTime, inline: false }
      )
      .setTimestamp()
      .setFooter({ text: "Please confirm or deny the reschedule request." });

    const confirmButton = new ButtonBuilder()
      .setCustomId("confirm_reschedule")
      .setLabel("Confirm")
      .setStyle(ButtonStyle.SUCCESS);

    const denyButton = new ButtonBuilder()
      .setCustomId("deny_reschedule")
      .setLabel("Deny")
      .setStyle(ButtonStyle.DANGER);

    const row = new ActionRowBuilder().addComponents(confirmButton, denyButton);

    message.channel.send({
      embeds: [embed],
      components: [row],
    });
  },
};
