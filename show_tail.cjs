const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'engine', 'storage', 'thumbnails.ts');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');
for (let i = Math.max(0, lines.length - 30); i < lines.length; i++) {
  console.log(`${i + 1}: ${lines[i]}`);
}