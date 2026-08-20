/**
 * Remember the questions the Director has already asked in a project so it
 * never asks the same thing twice. Persisted per project in localStorage.
 */

const KEY = (projectId: string) => `clipforge-asked-questions:${projectId}`

export function loadAskedQuestions(projectId: string): string[] {
  try {
    const raw = localStorage.getItem(KEY(projectId))
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

export function rememberAskedQuestion(projectId: string, question: string): string[] {
  const next = [...new Set([...loadAskedQuestions(projectId), question])]
  try {
    localStorage.setItem(KEY(projectId), JSON.stringify(next))
  } catch {
    // storage may be unavailable; memory-only is fine
  }
  return next
}

export function forgetAskedQuestions(projectId: string): void {
  try {
    localStorage.removeItem(KEY(projectId))
  } catch {
    // ignore
  }
}