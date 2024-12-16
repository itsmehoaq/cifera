# Hoaq's tournament helper

## Function
- [x] Match reschedule related tasks (players can initiate request without waiting for hosts' approval & announce schedule changes to staff)
- [ ] Check mapping deadlines
- [ ] Match ping
- [ ] Result post
- [ ] Staff interactions (Ref/Stream/Comm self-assign to matches)

## Setup guide
0. Rename `config.EXAMPLE.json` to `config.json`
1. You need a spreadsheet containing all related data fields. Unless you understand the code structure, good luck finding out which spreadsheet works with this bot.
2. Get Discord bot token stuff for `config.json`
3. Go to Google Cloud Console -> New Project (if empty) -> IAM & Admin -> Service Accounts
4. Create new service account & grant Editor permission
5. Create & download JSON key
7. `npm i && node index.js`

## Support
you are on your own. 
even I don't know what I'm doing.

## Special thanks
- HieuTrungMC, Mune and TryZ for making me interested in making weird stuff that I might never use
- Nebby and HieuTrungMC for helping with the development phase