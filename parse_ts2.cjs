const ts = require('typescript');
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'engine', 'storage', 'thumbnails.ts');
const content = fs.readFileSync(filePath, 'utf8');

const sourceFile = ts.createSourceFile(
  'thumbnails.ts',
  content,
  ts.ScriptTarget.Latest,
  true
);

function checkNode(node) {
  if (node.flags & ts.NodeFlags.Error) {
    console.log('Error node:', node.kind, node.getStart(), node.getEnd());
  }
  ts.forEachChild(node, checkNode);
}

checkNode(sourceFile);

const program = ts.createProgram(['thumbnails.ts'], {
  target: ts.ScriptTarget.Latest,
  module: ts.ModuleKind.ESNext,
  skipLibCheck: true,
});

const diagnostics = ts.getPreEmitDiagnostics(program);
diagnostics.forEach(d => {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(d.start);
  console.log(`Error at ${line + 1}:${character + 1}: ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`);
});

if (diagnostics.length === 0) {
  console.log('No syntax errors found');
}