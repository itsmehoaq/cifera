# Hoaq's tournament helper

## Function
- [x] Match reschedule related tasks
- [x] Check mapping deadlines
- [ ] Match ping
- [ ] Result post
- [ ] Staff interactions (Ref/Stream/Comm self-assign to matches)

## Setup guide
0. Rename `.env.EXAMPLE` to `.env`
1. You need a spreadsheet containing all related data fields. Unless you understand the code structure, good luck finding out which spreadsheet works with this bot.
2. Get Discord bot token stuff for `.env`
3. Go to Google Cloud Console -> New Project (if empty) -> IAM & Admin -> Service Accounts
4. Create new service account & grant Editor permission
5. Create & download JSON key
6. Copy & paste Google key file data to matching fields in `.env`
7. `npm i && node index.js`

## Support
you are on your own. 
even I don't know what I'm doing.

## Special thanks
Special thanks to HieuTrungMC, Mune and TryZ for making me interested in making weird stuff that I might never use again.