const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'engine', 'storage', 'thumbnails.ts');
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split(/\r?\n/);
console.log('Total lines:', lines.length);
console.log('Last line:', JSON.stringify(lines[lines.length - 1]));
console.log('Second to last:', JSON.stringify(lines[lines.length - 2]));

// Check for CRLF
const hasCRLF = content.includes('\r\n');
console.log('Has CRLF:', hasCRLF);
const hasLF = content.includes('\n');
console.log('Has LF:', hasLF);