const config = require("../config.json");
const sheets = require("../auth");
const sheetsConfig = require("../sheets-config.json");
const matchSheet = sheetsConfig.sheetName;

async function getSpreadsheetData() {
    const spreadsheetId = config.spreadsheetId;
    const range = `'${matchSheet}'`;

    const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
    })

    return response.data.values;
}

async function updateSpreadsheetData(range, values) {
    const spreadsheetId = config.spreadsheetId;
    const response = await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: "RAW",
        includeValuesInResponse: true,
        responseValueRenderOption: "FORMATTED_VALUE",
        requestBody: {
            "values": values,
        },
    });

    return response;
}

module.exports = { getSpreadsheetData, updateSpreadsheetData };