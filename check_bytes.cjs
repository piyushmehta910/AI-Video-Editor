const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'engine', 'storage', 'thumbnails.ts');
const buffer = fs.readFileSync(filePath);

// Check last 200 bytes
const last100 = buffer.subarray(-100);
console.log('Last 100 bytes (hex):', Buffer.from(last100).toString('hex'));
console.log('Last 100 bytes (ascii):', Buffer.from(last100).toString('ascii'));
console.log('---');
console.log('File size:', fs.statSync(filePath).size);