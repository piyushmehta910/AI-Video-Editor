const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'engine', 'storage', 'thumbnails.ts');
const buffer = fs.readFileSync(filePath);

// Check for BOM
const bom = buffer.slice(0, 4);
console.log('First 4 bytes (hex):', Buffer.from(bom).toString('hex'));
console.log('File size:', fs.statSync(filePath).size);

// Check last 100 chars
const content = fs.readFileSync(filePath, 'utf8');
console.log('Last 200 chars:');
console.log(content.slice(-200));
console.log('---');
console.log('Char codes of last 20 chars:');
const end = content.slice(-20);
for (let i = 0; i < end.length; i++) {
  console.log(`${i}: '${end[i]}' (${end.charCodeAt(i)})`);
}