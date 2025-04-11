function indexToColumn(index) {
    let column = '';
    while (index >= 0) {
        column = String.fromCharCode((index % 26) + 'A'.charCodeAt(0)) + column;
        index = Math.floor(index / 26) - 1;
    }
    return column;
}

module.exports = { indexToColumn };