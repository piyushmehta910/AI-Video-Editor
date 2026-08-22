/// <reference types="node" />
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const SCRIPT = path.resolve(import.meta.dirname, '../../scripts/check-hooks.mjs')
const REPO_ROOT = path.resolve(import.meta.dirname, '../..')

function runScanner(root: string) {
  return spawnSync(process.execPath, [SCRIPT], {
    encoding: 'utf8',
    env: { ...process.env, HOOKS_ROOT: root },
    timeout: 60_000,
  })
}

function writeFixture(root: string, name: string, code: string) {
  const dir = path.join(root, 'src')
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, name)
  fs.writeFileSync(file, code)
}

describe('rules of hooks (regression guard)', () => {
  it('finds no conditional/nested hook violations in src/', () => {
    const r = runScanner(REPO_ROOT)
    const output = `${r.stdout}${r.stderr}`
    if (r.status !== 0) {
      throw new Error(`Hook scanner failed on src/:\n${output}`)
    }
    expect(output).toContain('OK: no conditional / nested hook violations')
  })

  it('detects a hook called after an early return', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hooks-early-'))
    try {
      writeFixture(root,
        'BadEarlyReturn.tsx',
        [
          "import { useState } from 'react'",
          'export function Bad({ ok }: { ok: boolean }) {',
          '  if (!ok) return null',
          '  const [x] = useState(0)',
          '  return <div>{x}</div>',
          '}',
        ].join('\n'),
      )
      const r = runScanner(root)
      expect(r.status).toBe(1)
      const output = `${r.stdout}${r.stderr}`
      expect(output).toContain('hook-after-early-return')
      expect(output).toContain('BadEarlyReturn.tsx')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('detects a hook called inside an event-handler callback (the denoise bug shape)', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hooks-callback-'))
    try {
      writeFixture(root,
        'BadCallback.tsx',
        [
          "import { useState } from 'react'",
          'export function Worse({ onClick }: { onClick?: () => void }) {',
          '  const handler = () => {',
          '    const [y] = useState(0)',
          '    onClick?.()',
          '    void y',
          '  }',
          '  return <button onClick={handler} />',
          '}',
        ].join('\n'),
      )
      const r = runScanner(root)
      expect(r.status).toBe(1)
      const output = `${r.stdout}${r.stderr}`
      expect(output).toContain('hook-inside-callback')
      expect(output).toContain('BadCallback.tsx')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('accepts hooks inside useCallback/useEffect wrappers and custom hooks', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hooks-ok-'))
    try {
      writeFixture(root,
        'Fine.tsx',
        [
          "import React from 'react'",
          'function useThing() {',
          '  const [v, setV] = React.useState(0)',
          '  React.useEffect(() => { setV(1) }, [])',
          '  const memo = React.useMemo(() => v * 2, [v])',
          '  return { memo, setV }',
          '}',
          'export function Fine() {',
          '  const { memo } = useThing()',
          '  const cb = React.useCallback(() => memo + 1, [memo])',
          '  return <button onClick={cb}>{memo}</button>',
          '}',
        ].join('\n'),
      )
      const r = runScanner(root)
      expect(r.status).toBe(0)
      expect(`${r.stdout}${r.stderr}`).toContain('OK:')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})
