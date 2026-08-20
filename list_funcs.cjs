const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'engine', 'storage', 'thumbnails.ts');
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.match(/^\s*(async\s+)?function\s+\w+/) || line.match(/^\s*export\s+(interface|function|async\s+function)/)) {
    console.log(`${i + 1}: ${line.trim()}`);
  }
}