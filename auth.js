const fs = require('fs');
const { google } = require('googleapis');
const serviceAccount = require('./service-account.json');

const auth = new google.auth.GoogleAuth({
    credentials: serviceAccount,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: 'v4', auth });

module.exports = sheets;