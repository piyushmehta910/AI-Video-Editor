import { describe, expect, it } from 'vitest'
import { WORKER_NAMES, handleWorkerMessage, parseWorkerMessage } from './workerProtocol'

describe('parseWorkerMessage', () => {
  it('accepts a valid message', () => {
    expect(parseWorkerMessage({ type: 'health', requestId: 'abc' })).toEqual({
      type: 'health',
      requestId: 'abc',
    })
  })

  it('rejects non-objects and missing fields', () => {
    expect(parseWorkerMessage(null)).toBeNull()
    expect(parseWorkerMessage('health')).toBeNull()
    expect(parseWorkerMessage(42)).toBeNull()
    expect(parseWorkerMessage({ type: 'health' })).toBeNull()
    expect(parseWorkerMessage({ requestId: 'abc' })).toBeNull()
    expect(parseWorkerMessage({ type: 1, requestId: 'abc' })).toBeNull()
  })
})

describe('handleWorkerMessage round-trip', () => {
  it.each(WORKER_NAMES)('answers a health check for the %s worker', (worker) => {
    const resp = handleWorkerMessage({ type: 'health', requestId: 'req-1' }, worker)
    expect(resp).toEqual({
      type: 'health',
      requestId: 'req-1',
      worker,
      ok: true,
      ts: expect.any(Number) as unknown as number,
    })
  })

  it('ignores non-health messages', () => {
    expect(handleWorkerMessage({ type: 'do-work', requestId: 'x' }, 'decode')).toBeNull()
    expect(handleWorkerMessage(null, 'render')).toBeNull()
  })
})