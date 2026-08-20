const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'engine', 'motion', 'sandbox.ts');
const content = fs.readFileSync(filePath, 'utf8');

let open = 0
let lineNum = 0
for (const line of content.split('\n')) {
  lineNum++
  for (const char of line) {
    if (char === '{') open++
    else if (char === '}') {
      open--
      if (open < 0) {
        console.log(`Negative at line ${lineNum}`)
      }
    }
  }
  if (open < 0) break
}
console.log('Final open count:', open)