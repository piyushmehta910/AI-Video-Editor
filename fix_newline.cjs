const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'engine', 'storage', 'thumbnails.ts');
const buffer = fs.readFileSync(filePath);

// Add newline at end if missing
if (buffer[buffer.length - 1] !== 10) {
  const newBuffer = Buffer.concat([buffer, Buffer.from('\n')]);
  fs.writeFileSync(filePath, newBuffer);
  console.log('Added newline at end of file');
} else {
  console.log('File already ends with newline');
}