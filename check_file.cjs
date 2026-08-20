const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'engine', 'storage', 'thumbnails.ts');
const buffer = fs.readFileSync(filePath);

console.log('First 10 bytes (hex):', Buffer.from(buffer.slice(0, 10)).toString('hex'));
console.log('First 10 bytes (ascii):', Buffer.from(buffer.slice(0, 10)).toString('ascii'));
console.log('Last 50 bytes (hex):');
const last50 = buffer.slice(-50);
console.log(Buffer.from(buffer.slice(-50)).toString('hex').match(/.{1,64}/g).join('\n'));
console.log('Last 50 bytes (ascii):');
console.log(Buffer.from(buffer.slice(-50)).toString('ascii'));
console.log('File size:', buffer.length);