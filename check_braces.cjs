const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'engine', 'storage', 'thumbnails.ts');
const content = fs.readFileSync(filePath, 'utf8');

// Check if it parses as valid TypeScript/JavaScript
try {
  // Simple check: count braces
  let open = 0;
  let inString = false;
  let stringChar = '';
  let escaped = false;
  
  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    
    if (escaped) {
      escaped = false;
      continue;
    }
    
    if (c === '\\' && inString) {
      escaped = true;
      continue;
    }
    
    if ((c === '"' || c === "'" || c === '`') && !escaped) {
      if (!inString) {
        inString = true;
        stringChar = content[i];
      } else if (content[i] === stringChar) {
        inString = false;
        stringChar = '';
      }
      continue;
    }
    
    if (!inString) {
      if (content[i] === '{') {
        // check if it's a template literal or object
        console.log(`Line ${content.substring(0, i).split('\n').length}: Open brace`);
      } else if (content[i] === '}') {
        console.log(`Line ${content.substring(0, i).split('\n').length}: Close brace`);
      }
    }
  }
  
  console.log('Done checking');
} catch (e) {
  console.error('Error:', e.message);
}