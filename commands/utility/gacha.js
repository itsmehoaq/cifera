const {EmbedBuilder, SlashCommandBuilder,} = require("discord.js");
const sheetsConfig = require('../../sheets-config.json');
const {getSpreadsheetData, updateSpreadsheetData} = require("../../modules/spreadsheetFunctions.js");
const {columnToIndex} = require("../../modules/columnToIndex.js");
const {indexToColumn} = require("../../modules/indexToColumn.js");
const gachaSheetName = sheetsConfig.gachaSheetName;
const gachaDiscordId = sheetsConfig.gachaDiscordId
const gachaRCol = sheetsConfig.gachaRCol
const gachaSRCol = sheetsConfig.gachaSRCol
const gachaSSRCol = sheetsConfig.gachaSSRCol
const gachaTrapCardCol = sheetsConfig.gachaTrapCardCol
const lastRolledCards = new Map();
let ampData = require("../../ampData.json");
module.exports = {
  data: new SlashCommandBuilder()
      .setName('gacha')
      .setDescription('Press your luck.'), execute: async (interaction) => {

    function shuffleArray(array) {
      //you know where i get this from :3
      const newArray = [...array];
      for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
      }
      return newArray;
    }

    function createCardEmbed(card) {
      const embed = new EmbedBuilder()
          .setTitle(`${card.name} (${card.rarity})`)
          .setDescription(`**Category**: ${card.category}\n\n${card.desc.replaceAll("\\n", `\n`)}`) //why json doesn't just support `` symbol life would be better :(
          .setColor(getColorByRarity(card.rarity));
      if (card.condition && card.condition !== "") {
        embed.addFields({name: 'Điều kiện phụ', value: card.condition});
      }
      (card.icon && card.icon !== "") ? embed.setThumbnail(card.icon) : embed.setThumbnail(`https://s.hoaq.works/${card.id}.png`);
      return embed;
    }

    function getColorByRarity(rarity) {
      switch (rarity) {
        case 'R':
          return 0x8ca7a2;
        case 'SR':
          return 0x67c8b5;
        case 'SSR':
          return 0xff696a;
        case 'UR':
          return 0xfed269;
        case 'Trap Card':
          return 0xb97dd7;
        default:
          return 0xffffff;
      }
    }

    async function findUserRowInSheet(userId) {
      try {
        const sheetData = await getSpreadsheetData(gachaSheetName);
        if (!sheetData || sheetData.length <= 1) {
          return {rowNumber: -1, hasRolled: false};
        }

        for (let i = 1; i < sheetData.length; i++) {
          const row = sheetData[i];
          const discordIdColIndex = columnToIndex(gachaDiscordId);
          const rResultColIndex = columnToIndex(gachaRCol);

          if (row && row[discordIdColIndex] === userId) {
            const hasRolled = row.length > rResultColIndex && row[rResultColIndex] && row[rResultColIndex].trim() !== "";
            return {rowNumber: i + 1, hasRolled: hasRolled};
          }
        }

        return {rowNumber: -1, hasRolled: false};
      } catch (error) {
        console.error("Error finding user in spreadsheet:", error);
        return {rowNumber: -1, hasRolled: false};
      }
    }

    async function updateGachaResults(rowNumber, selectedCards) {
      try {
        if (rowNumber <= 1) {
          return false;
        }

        const updates = [];

        let rCard = selectedCards.find(card => card.rarity === "R");
        let srCard = selectedCards.find(card => card.rarity === "SR");
        let ssrUrCard = selectedCards.find(card => card.rarity === "SSR" || card.rarity === "UR");
        let trapCard = selectedCards.find(card => card.category === "Trap Card");

        if (rCard) {
          updates.push({
            range: `'${gachaSheetName}'!${gachaRCol}${rowNumber}`, values: [[rCard.name]]
          });
        }

        if (srCard) {
          updates.push({
            range: `'${gachaSheetName}'!${gachaSRCol}${rowNumber}`, values: [[srCard.name]]
          });
        }

        if (ssrUrCard) {
          updates.push({
            range: `'${gachaSheetName}'!${gachaSSRCol}${rowNumber}`, values: [[ssrUrCard.name]]
          });
        }

        if (trapCard) {
          updates.push({
            range: `'${gachaSheetName}'!${gachaTrapCardCol}${rowNumber}`, values: [[trapCard.name]]
          });
        }

        for (const update of updates) {
          await updateSpreadsheetData(update.range, update.values);
        }

        return true;
      } catch (error) {
        console.error("Error updating gacha results:", error);
        return false;
      }
    }

    function pickRandomCard(cardPool, urRate = 0.03) {
      if (!cardPool || cardPool.length === 0) {
        return { card: null, remainingPool: [], newUrRate: urRate };
      }
      let selectedCard = null;
      let pickedUR = false;
      let urResult = Math.random();
      if (urResult < urRate) {
        const urCards = cardPool.filter(card => card.rarity === "UR");
        if (urCards.length > 0) {
          const randomIndex = Math.floor(Math.random() * urCards.length);
          selectedCard = urCards[randomIndex];
          pickedUR = true;
        }
      }
      if (!selectedCard) {
        const cardPoolNoURYet = cardPool.filter(card => card.rarity !== "UR");
        const randomIndex = Math.floor(Math.random() * cardPoolNoURYet.length);
        selectedCard = cardPoolNoURYet[randomIndex];
      }
      const remainingPool = cardPool.filter(card => {
        if (selectedCard.rarity === "SSR" || selectedCard.rarity === "UR") {
          return !(card.rarity === "SSR" || card.rarity === "UR" || card.category === selectedCard.category);
        }
        return !(card.rarity === selectedCard.rarity || card.category === selectedCard.category);
      });
      const newUrRate = pickedUR ? urRate : urRate + 0.035;
      return {
        card: selectedCard,
        remainingPool,
        newUrRate
      };
    }
    await interaction.deferReply();
    const userId = interaction.user.id;
    const userName = interaction.user.username;
    const userInfo = await findUserRowInSheet(userId);
    if (userInfo.rowNumber > 0) {
      if (userInfo.hasRolled) {
        const alreadyRolledEmbed = new EmbedBuilder()
            .setTitle("Bạn đã roll rồi!")
            .setDescription(`Kết quả roll đã được định đoạt. Chúc team bạn may mắn trong trận tiếp theo!`)
            .setColor(0xFF9900)
        await interaction.editReply({
          content: null, embeds: [alreadyRolledEmbed]
        });
        return;
      }
      try {
        let selectedCards = [];
        const trapCards = ampData.filter(card => card.category === "Trap Card");
        const previousCards = lastRolledCards.get(userId) || [];
        let mainCardPool = ampData.filter(card => {
          return card.category !== "Trap Card" &&
              !previousCards.some(prevCard => prevCard.id === card.id);
        });
        for (let i = 0; i < 727; i++) {
          mainCardPool = shuffleArray(mainCardPool);
        }
        const shuffledTrapCards = shuffleArray(
            trapCards.filter(card => !previousCards.some(prevCard => prevCard.id === card.id))
        );
        let urRate = 0.03;
        for (let i = 0; i < 3; i++) {
          const result = pickRandomCard(mainCardPool, urRate);
          if (result.card) {
            selectedCards.push(result.card);
            mainCardPool = result.remainingPool;
            urRate = result.newUrRate;
          }
        }

        const rarities = selectedCards.map(card => card.rarity);

        if (!rarities.includes("R")) {
          const rCards = ampData.filter(card => card.rarity === "R");
          if (rCards.length > 0) {
            const randomIndex = Math.floor(Math.random() * rCards.length);
            selectedCards.push(rCards[randomIndex]);
          }
        }

        if (!rarities.includes("SR")) {
          const srCards = ampData.filter(card => card.rarity === "SR");
          if (srCards.length > 0) {
            const randomIndex = Math.floor(Math.random() * srCards.length);
            selectedCards.push(srCards[randomIndex]);
          }
        }

        if (!rarities.includes("SSR") && !rarities.includes("UR")) {
          const ssrCards = ampData.filter(card => card.rarity === "SSR");
          if (ssrCards.length > 0) {
            const randomIndex = Math.floor(Math.random() * ssrCards.length);
            selectedCards.push(ssrCards[randomIndex]);
          }
        }

        if (shuffledTrapCards.length > 0) {
          selectedCards.push(shuffledTrapCards[0]);
        }

        selectedCards = selectedCards.slice(0, 4);

        let sheetUpdateMessage = "";
        const updateSuccess = await updateGachaResults(userInfo.rowNumber, selectedCards);
        if (updateSuccess) {
          sheetUpdateMessage = "✅ Saved!";
          lastRolledCards.set(userId, selectedCards);
        } else {
          sheetUpdateMessage = "❌ goi goi co loi xay ra chung toi da ping <@246619988050444288> de vao cuoc dieu tra.";
        }
        selectedCards.sort((a, b) => {
          if (a.category === "Trap Card") return 1;
          if (b.category === "Trap Card") return -1;

          const rarityOrder = {"R": 1, "SR": 2, "SSR": 3, "UR": 4};
          return rarityOrder[a.rarity] - rarityOrder[b.rarity];
        });

        const embeds = selectedCards.map(card => createCardEmbed(card));

        await interaction.editReply({
          content: `${sheetUpdateMessage}\n\n<@${userId}> đã gacha ra các thẻ sau:`, embeds: embeds
        });

      } catch (error) {
        console.error("Error in gacha command:", error);
        await interaction.editReply({
          content: "An error occurred while processing your gacha roll.", ephemeral: true
        });
      }
    } else {
      const accessDenied403 = new EmbedBuilder()
          .setTitle("❌ nuh uh")
          .setDescription(`Chỉ có Captain thuộc 16 team trong Bracket mới được sử dụng lệnh này!`)
          .setColor(0xFF9900)
      await interaction.editReply({
        content: null, embeds: [accessDenied403], ephemeral: true,
      });
    }
  }
}
