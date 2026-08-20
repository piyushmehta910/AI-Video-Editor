import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { forgetAskedQuestions, loadAskedQuestions, rememberAskedQuestion } from './askedQuestions'

const store = new Map<string, string>()
;(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
}

const KEY = 'clipforge-asked-questions:test-project'

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  forgetAskedQuestions('test-project')
})

describe('askedQuestions', () => {
  it('returns an empty list when nothing was asked', () => {
    expect(loadAskedQuestions('test-project')).toEqual([])
  })

  it('remembers a question and persists it', () => {
    const next = rememberAskedQuestion('test-project', 'Which clip should I trim?')
    expect(next).toEqual(['Which clip should I trim?'])
    expect(JSON.parse(localStorage.getItem(KEY) || '[]')).toEqual(['Which clip should I trim?'])
  })

  it('never asks the same question twice', () => {
    rememberAskedQuestion('test-project', 'Which clip?')
    const loaded = loadAskedQuestions('test-project')
    expect(loaded).toEqual(['Which clip?'])
    expect(loaded.filter((q) => q === 'Which clip?')).toHaveLength(1)
  })

  it('deduplicates across projects', () => {
    rememberAskedQuestion('test-project', 'Same question?')
    rememberAskedQuestion('other-project', 'Same question?')
    expect(loadAskedQuestions('test-project')).toEqual(['Same question?'])
    expect(loadAskedQuestions('other-project')).toEqual(['Same question?'])
    expect(localStorage.getItem(KEY)).toContain('Same question?')
  })

  it('forgets all questions for a project', () => {
    rememberAskedQuestion('test-project', 'Q1')
    forgetAskedQuestions('test-project')
    expect(loadAskedQuestions('test-project')).toEqual([])
  })
})