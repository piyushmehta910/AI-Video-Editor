const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'engine', 'storage', 'thumbnails.ts');
const buffer = fs.readFileSync(filePath);

// Check if file ends with newline
const lastByte = buffer[buffer.length - 1];
console.log('Last byte:', lastByte, '(', String.fromCharCode(lastByte), ')');
console.log('Is newline (10):', lastByte === 10);
console.log('Is carriage return (13):', lastByte === 13);