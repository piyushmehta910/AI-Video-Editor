const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'engine', 'storage', 'thumbnails.ts');
const content = fs.readFileSync(filePath, 'utf8');

// Try to parse with TypeScript compiler API
const ts = require('typescript');

const sourceFile = ts.createSourceFile(
  'thumbnails.ts',
  fs.readFileSync(filePath, 'utf8'),
  ts.ScriptTarget.Latest,
  true
);

function checkNode(node) {
  if (node.flags & ts.NodeFlags.Error) {
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    console.log('Error at line', line + 1, 'char', character + 1, 'kind:', node.kind);
  }
  ts.forEachChild(node, checkNode);
}

checkNode(sourceFile);

const diagnostics = ts.getPreEmitDiagnostics(
  ts.createProgram(['thumbnails.ts'], {
    target: ts.ScriptTarget.Latest,
    module: ts.ModuleKind.ESNext,
    skipLibCheck: true,
  })
);

diagnostics.forEach(d => {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(d.start);
  console.log(`Error at ${line + 1}:${character + 1}: ${require('typescript').flattenDiagnosticMessageText(d.messageText, '\n')}`);
});

if (diagnostics.length === 0) {
  console.log('No syntax errors found');
}