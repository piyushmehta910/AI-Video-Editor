const fs = require('fs');
const content = fs.readFileSync('E:/Open code project/ai video editor/src/ui/ai/AIDirector.tsx', 'utf8');
const idx = content.indexOf('{issues.length > 0 && (');
const before = content.slice(0, idx);
const searchStr = '{issues.length > 0 && (\n                <div className="max-h-40 space-y-1 overflow-y-auto px-3 pb-2.5">\n';
const after = content.slice(idx + searchStr.length);
const newContent = before + '{issues.length > 0 && (\n                <div className="max-h-40 space-y-1 overflow-y-auto px-3 pb-2.5">\n                  {issues.map((issue) => (';
fs.writeFileSync('E:/Open code project/ai video editor/src/ui/ai/AIDirector.tsx', newContent);
console.log('Fixed');