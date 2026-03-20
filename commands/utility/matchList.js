const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const config = require("../../config.json");
const sheetsConfig = require("../../sheets-config.json");
const bracketUnixColumn = sheetsConfig.bracketUnixColumn;
const matchSheet = sheetsConfig.sheetName;
const matchIdColumn = sheetsConfig.matchIdColumn;
const teamAColumn = sheetsConfig.teamAColumn;
const teamBColumn = sheetsConfig.teamBColumn;
const refereeColumn = sheetsConfig.refereeColumn;
const streamerColumn = sheetsConfig.streamerColumn;
const comm1Column = sheetsConfig.comm1Column;
const comm2Column = sheetsConfig.comm2Column;
const { getSpreadsheetData } = require("../../modules/spreadsheetFunctions.js");
const { columnToIndex } = require("../../modules/columnToIndex.js");

async function getUpcomingMatches(filters = {}) {
  try {
    const now = new Date();
    const currentUnixTime = Math.floor(now.getTime() / 1000);

    const rows = await getSpreadsheetData(matchSheet);

    let upcomingMatches = rows
      .filter((row) => {
        const matchTimeUnix = row[columnToIndex(bracketUnixColumn)];
        return matchTimeUnix && parseInt(matchTimeUnix) > currentUnixTime;
      })
      .map((row) => {
        return {
          matchId: row[columnToIndex(matchIdColumn)],
          matchTimeUnix: parseInt(row[columnToIndex(bracketUnixColumn)]),
          teamA: row[columnToIndex(teamAColumn)],
          teamB: row[columnToIndex(teamBColumn)],
          referee: row[columnToIndex(refereeColumn)],
          streamer: row[columnToIndex(streamerColumn)],
          comm1: row[columnToIndex(comm1Column)],
          comm2: row[columnToIndex(comm2Column)],
        };
      });

    if (filters.referee) {
      upcomingMatches = upcomingMatches.filter((match) => {
        if (filters.referee.toLowerCase() === "none") {
          return !match.referee || match.referee.trim() === "";
        } else {
          return match.referee === filters.referee;
        }
      });
    }

    if (filters.streamer) {
      upcomingMatches = upcomingMatches.filter((match) => {
        if (filters.streamer.toLowerCase() === "none") {
          return !match.streamer || match.streamer.trim() === "";
        } else {
          return match.streamer === filters.streamer;
        }
      });
    }

    if (filters.comm1) {
      upcomingMatches = upcomingMatches.filter((match) => {
        if (filters.comm1.toLowerCase() === "none") {
          return !match.comm1 || match.comm1.trim() === "";
        } else {
          return match.comm1 === filters.comm1;
        }
      });
    }

    if (filters.comm2) {
      upcomingMatches = upcomingMatches.filter((match) => {
        if (filters.comm2.toLowerCase() === "none") {
          return !match.comm2 || match.comm2.trim() === "";
        } else {
          return match.comm2 === filters.comm2;
        }
      });
    }

    upcomingMatches.sort((a, b) => a.matchTimeUnix - b.matchTimeUnix);

    return upcomingMatches;
  } catch (error) {
    console.error("Error fetching upcoming matches:", error);
    throw error;
  }
}

function createMatchListEmbed(matches, page = 1, filters = {}) {
  const matchesPerPage = 4;
  const totalPages = Math.ceil(matches.length / matchesPerPage);

  page = Math.max(1, Math.min(page, totalPages || 1));

  const startIndex = (page - 1) * matchesPerPage;
  const endIndex = Math.min(startIndex + matchesPerPage, matches.length);
  const pageMatches = matches.slice(startIndex, endIndex);

  let title = "Upcoming Matches";
  let description = `Showing matches ${startIndex + 1}-${endIndex} of ${matches.length}`;

  const embed = new EmbedBuilder()
    .setColor("#00AAFF")
    .setTitle(title)
    .setDescription(description)
    .setTimestamp()
    .setFooter({ text: `Page ${page}/${totalPages || 1}` });

  if (filters.referee || filters.streamer || filters.comm1 || filters.comm2) {
    let filterInfo = [];

    if (filters.referee) {
      if (filters.referee.toLowerCase() === "none") {
        filterInfo.push("Showing matches needing referees");
      } else {
        filterInfo.push(`Referee: <@${filters.referee}>`);
      }
    }

    if (filters.streamer) {
      if (filters.streamer.toLowerCase() === "none") {
        filterInfo.push("Showing matches needing streamers");
      } else {
        filterInfo.push(`Streamer: <@${filters.streamer}>`);
      }
    }
    if (filters.comm1 || filters.comm2) {
      if (
        (filters.comm1 && filters.comm1.toLowerCase() === "none") ||
        (filters.comm2 && filters.comm2.toLowerCase() === "none")
      ) {
        filterInfo.push("Showing matches needing commentators");
      }
    }

    embed.addFields({ name: "Applied Filters", value: filterInfo.join("\n") });
  }

  if (matches.length === 0) {
    embed.addFields({
      name: "No Matches Found",
      value: "No matches match the current filter criteria.",
    });
  } else {
    let matchListContent = "";
    pageMatches.forEach((match) => {
      const refereeInfo = match.referee
        ? `Referee: <@${match.referee}>`
        : "Referee: None";
      const streamerInfo = match.streamer
        ? `Streamer: <@${match.streamer}>`
        : "Streamer: None";
      const commInfo = match.comm1
        ? `Commentator: <@${match.comm1}> <@${match.comm2}>`
        : "Commentator: None";

      matchListContent += `ID: \`${match.matchId}\` - <t:${match.matchTimeUnix}:f>\n`;
      matchListContent += `Match-up: \`${match.teamA}\` vs \`${match.teamB}\`\n`;
      matchListContent += `${refereeInfo} • ${streamerInfo}\n${commInfo}\n\n`;
    });

    embed.addFields({ name: "Scheduled Matches", value: matchListContent });
  }

  return {
    embed,
    currentPage: page,
    totalPages: totalPages || 1,
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("match")
    .setDescription("Commands for match management")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("list")
        .setDescription("List all upcoming matches")
        .addIntegerOption((option) =>
          option
            .setName("page")
            .setDescription("Page number to display")
            .setRequired(false),
        )
        .addStringOption((option) =>
          option
            .setName("referee")
            .setDescription("Filter by referee ID or 'none' for unassigned")
            .setRequired(false),
        )
        .addStringOption((option) =>
          option
            .setName("streamer")
            .setDescription("Filter by streamer ID or 'none' for unassigned")
            .setRequired(false),
        )
        .addStringOption((option) =>
          option
            .setName("commentator_1")
            .setDescription(
              "Filter by commentator 1 ID or 'none' for no commentator",
            )
            .setRequired(false),
        )
        .addStringOption((option) =>
          option
            .setName("commentator_2")
            .setDescription(
              "Filter by commentator 2 ID or 'none' for no commentator",
            )
            .setRequired(false),
        ),
    ),

  execute: async (interaction) => {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "list") {
      const refereeFilter = interaction.options.getString("referee");
      const streamerFilter = interaction.options.getString("streamer");
      const comm1Filter = interaction.options.getString("commentator_1");
      const comm2Filter = interaction.options.getString("commentator_2");
      const requestedPage = interaction.options.getInteger("page") || 1;

      const filters = {};
      if (refereeFilter) filters.referee = refereeFilter;
      if (streamerFilter) filters.streamer = streamerFilter;
      if (comm1Filter) filters.comm1 = comm1Filter;
      if (comm2Filter) filters.comm2 = comm2Filter;

      await interaction.deferReply();

      try {
        const upcomingMatches = await getUpcomingMatches(filters);

        const { embed, currentPage, totalPages } = createMatchListEmbed(
          upcomingMatches,
          requestedPage,
          filters,
        );

        await interaction.editReply({
          embeds: [embed],
          components: [],
        });
      } catch (error) {
        console.error("Error executing match list command:", error);
        await interaction.editReply({
          content:
            "An error occurred while fetching the match list. Please try again later.",
          ephemeral: true,
        });
      }
    }
  },
};
