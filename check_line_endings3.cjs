const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'engine', 'storage', 'thumbnails.ts');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// Check lines 370-385
for (let i = 370; i < Math.min(lines.length, 385); i++) {
  console.log(`${i + 1}: "${lines[i]}" (len=${lines[i].length})`);
}

// Check for any invisible characters at the end
const lastLine = content.trimEnd();
console.log('Ends with newline:', content.endsWith('\n'));
console.log('Last char code:', content.charCodeAt(content.length - 1));