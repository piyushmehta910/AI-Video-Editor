const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'engine', 'storage', 'thumbnails.ts');
const buffer = fs.readFileSync(filePath);

// Check last 50 bytes
const last50 = buffer.subarray(-50);
console.log('Last 50 bytes (hex):', Buffer.from(last50).toString('hex'));
console.log('Last 50 bytes (ascii):', Buffer.from(last50).toString('ascii'));
console.log('File size:', fs.statSync(filePath).size);