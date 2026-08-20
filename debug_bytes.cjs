const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'engine', 'storage', 'thumbnails.ts');
const buffer = fs.readFileSync(filePath);

// Check bytes around the end
const end = buffer.subarray(-200);
console.log('Last 200 bytes (hex):');
const hex = Buffer.from(end).toString('hex');
for (let i = 0; i < hex.length; i += 32) {
  console.log(hex.slice(i, i + 32));
}

console.log('\nDecoded:');
console.log(Buffer.from(end).toString('utf8'));

console.log('\nFile size:', require('fs').statSync(filePath).size);