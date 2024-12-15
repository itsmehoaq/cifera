function columnToIndex(column) {
    let index = 0;
    for (let i = 0; i < column.length; i++) {
        index = index * 26 + column.charCodeAt(i) - 'A'.charCodeAt(0) + 1;
    }
    return index - 1;
}

module.exports = { columnToIndex };