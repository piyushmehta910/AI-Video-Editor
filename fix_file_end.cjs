const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'engine', 'storage', 'thumbnails.ts');
const content = fs.readFileSync(filePath, 'utf8');

// Remove trailing whitespace and ensure exactly one newline at end
const trimmed = content.trimEnd() + '\n';
fs.writeFileSync(filePath, trimmed);
console.log('Fixed file ending');