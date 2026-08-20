const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'engine', 'storage', 'thumbnails.ts');
const buffer = fs.readFileSync(filePath);

console.log('File size:', buffer.length);

// Check around the end
const end = buffer.subarray(-100);
console.log('Last 100 bytes (hex):');
console.log(Buffer.from(end).toString('hex').match(/.{1,64}/g).join('\n'));

console.log('\nLast 50 bytes (ascii):');
console.log(Buffer.from(end).toString('ascii'));