function isLeapYear(year) {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

function checkTime(hour, minute) {
    return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

function checkDate(day, month, year, hour, minutes) {
    day = parseInt(day);
    month = parseInt(month);
    year = parseInt(year);
    hour = parseInt(hour);
    minutes = parseInt(minutes);

    if (isNaN(day) || isNaN(month) || isNaN(year) || isNaN(hour) || isNaN(minutes)) return false;

    const currentDate = new Date();
    const inputDate = new Date(year, month - 1, day, hour, minutes);
    if (inputDate < currentDate) return false;

    if (year < 1900 || year > 9999) return false;
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;

    const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (isLeapYear(year)) daysInMonth[1] = 29;

    return day <= daysInMonth[month - 1] && checkTime(hour, minutes);
}

function parseAndAdjust(dateStr, timeStr, timezone) {
    const [day, month, year] = dateStr.split('/');
    let [hourRaw, minute] = timeStr.split(':');

    let hour = (parseInt(hourRaw) - timezone + 24) % 24;

    if (!checkDate(day, month, year, hour, minute)) return null;

    const d = parseInt(day), m = parseInt(month), y = parseInt(year);
    const min = parseInt(minute);

    const unixTime = new Date(y, m - 1, d, hour, min).getTime() / 1000;

    const paddedHour = String(hour).padStart(2, '0');
    const paddedMin = String(min).padStart(2, '0');
    const paddedDay = String(d).padStart(2, '0');
    const paddedMonth = String(m).padStart(2, '0');

    return {
        dateStr: `${paddedDay}/${paddedMonth}/${y}`,
        timeStr: `${paddedHour}:${paddedMin}`,
        unixTime,
    };
}

function parseSheetDateTimeToUnix(dateStr, timeStr) {
    if (!dateStr || !timeStr) return null;
    const [day, month, year] = dateStr.split('/').map(Number);
    const [hour, minute] = timeStr.split(':').map(Number);
    if ([day, month, year, hour, minute].some(isNaN)) return null;
    return new Date(year, month - 1, day, hour, minute).getTime() / 1000;
}

module.exports = { checkDate, parseAndAdjust, parseSheetDateTimeToUnix };
