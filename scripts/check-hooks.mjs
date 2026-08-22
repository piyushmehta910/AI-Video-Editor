import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const ROOT = process.env.HOOKS_ROOT ?? process.cwd()
const SRC = path.join(ROOT, 'src')
const HOOK_RE = /^use[A-Z0-9]/
const SAFE_WRAPPERS = new Set(['useCallback', 'useEffect', 'useMemo', 'useReducer', 'useImperativeHandle'])

export const violations = []

function isHookCall(node) {
  if (!ts.isCallExpression(node)) return false
  const expr = node.expression
  if (ts.isIdentifier(expr)) return HOOK_RE.test(expr.text)
  if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.expression) && expr.expression.text === 'React') {
    return HOOK_RE.test(expr.name.text)
  }
  return false
}

/** Walk every function-like node and report hook calls that happen inside
 * nested callbacks which are NOT custom-hook bodies (useCallback etc.). */
function checkNestedHooks(sourceFile) {
  function visit(node, enclosingFnName, fnDepth) {
    if (isHookCall(node)) {
      // A hook call is legal only when the nearest enclosing function is a
      // component or custom hook (checked by caller) — i.e. fnDepth === 0 here.
      if (fnDepth > 0 && !insideSafeWrapper(node)) {
        violations.push({
          file: sourceFile.fileName,
          line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          kind: 'hook-inside-callback',
          detail: `Hook called inside a nested callback of ${enclosingFnName || 'anonymous function'}`,
        })
        return
      }
    }
    node.forEachChild((child) => {
      if (ts.isFunctionDeclaration(child)) {
        visit(child, child.name?.text ?? enclosingFnName, 0)
      } else if (ts.isMethodDeclaration(child)) {
        visit(child, child.name?.getText() ?? enclosingFnName, 0)
      } else if (
        (ts.isArrowFunction(child) || ts.isFunctionExpression(child))
      ) {
        // Determine whether this arrow/fn is a safe wrapper argument.
        const parent = child.parent
        const parentIsSafeCall =
          ts.isCallExpression(parent) &&
          ts.isIdentifier(parent.expression) &&
          SAFE_WRAPPERS.has(parent.expression.text) &&
          parent.arguments.includes(child)
        if (parentIsSafeCall) {
          // Custom-hook body: hooks allowed at depth 0 of THIS function.
          child.forEachChild((c) => visit(c, enclosingFnName, 0))
        } else {
          child.forEachChild((c) => visit(c, enclosingFnName, fnDepth + 1))
        }
      } else {
        visit(child, enclosingFnName, fnDepth)
      }
    })
  }

  function insideSafeWrapper(node) {
    let cur = node.parent
    while (cur) {
      if (
        ts.isCallExpression(cur) &&
        ts.isIdentifier(cur.expression) &&
        SAFE_WRAPPERS.has(cur.expression.text)
      ) {
        return true
      }
      if (ts.isFunctionLike(cur) || ts.isSourceFile(cur)) return false
      cur = cur.parent
    }
    return false
  }

  visit(sourceFile, sourceFile.fileName, 0)
}

/** Flag hook calls that appear AFTER an unconditional early `return`
 * within the same component/hook function body. */
function checkEarlyReturnBeforeHook(sourceFile) {
  function checkBody(body, label) {
    const stmts = ts.isBlock(body) ? body.statements : [body]
    let returnedAt = -1
    for (let i = 0; i < stmts.length; i++) {
      const s = stmts[i]
      if (returnedAt >= 0) {
        const found = findHook(s, new Set())
        if (found) {
          violations.push({
            file: sourceFile.fileName,
            line: sourceFile.getLineAndCharacterOfPosition(found.getStart()).line + 1,
            kind: 'hook-after-early-return',
            detail: `${label}: hook runs after an early return on statement #${returnedAt + 1}`,
          })
        }
      }
      if (ts.isReturnStatement(s)) returnedAt = i
      if (ts.isIfStatement(s) && ts.isReturnStatement(s.thenStatement)) returnedAt = i
    }
  }

  function findHook(node, seen) {
    if (seen.has(node)) return undefined
    seen.add(node)
    if (isHookCall(node) && !isArgOfSafeWrapper(node)) return node
    for (const child of node.getChildren()) {
      const hit = findHook(child, seen)
      if (hit) return hit
    }
    return undefined
  }

  function isArgOfSafeWrapper(callNode) {
    let cur = callNode.parent
    while (cur && !ts.isFunctionLike(cur)) {
      if (
        ts.isCallExpression(cur) &&
        ts.isIdentifier(cur.expression) &&
        SAFE_WRAPPERS.has(cur.expression.text)
      ) {
        return true
      }
      cur = cur.parent
    }
    return false
  }

  function visit(node) {
    if (
      (ts.isFunctionDeclaration(node) && node.name && /^[A-Z]|^use/.test(node.name.text) && node.body) ||
      ((ts.isVariableDeclaration(node)) &&
        node.name.getText().match(/^[A-Z]/) &&
        (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)))
    ) {
      const body = ts.isVariableDeclaration(node) ? node.initializer.body : node.body
      if (body) checkBody(body, node.name?.getText?.() ?? 'component')
    }
    node.forEachChild(visit)
  }

  visit(sourceFile)
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(p)
    else if (/\.tsx?$/.test(entry.name) && !/\.test\./.test(entry.name)) {
      const text = fs.readFileSync(p, 'utf8')
      if (!/\buse[A-Z]/.test(text)) continue
      const sf = ts.createSourceFile(p, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
      checkNestedHooks(sf)
      checkEarlyReturnBeforeHook(sf)
    }
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  walk(SRC)
  if (violations.length) {
    console.error(`\n${violations.length} rules-of-hooks violation(s):`)
    for (const v of violations) console.error(`  ${v.file}:${v.line} — ${v.kind}\n    ${v.detail}`)
    process.exit(1)
  } else {
    console.log('OK: no conditional / nested hook violations found in src/')
  }
}
