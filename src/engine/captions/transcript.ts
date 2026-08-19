export interface WordStamp {
  word: string
  start: number
  end: number
}

export interface SentenceStamp {
  start: number
  end: number
  text: string
}

const SENTENCE_END = /[.!?…]+$/

/**
 * Group word-level timestamps into sentences. A sentence ends at a word that
 * terminates with sentence punctuation, or when the accumulated text reaches
 * `maxChars` (long run-on speech still gets split for manageable captions).
 */
export function groupWordsIntoSentences(words: WordStamp[], maxChars = 200): SentenceStamp[] {
  const sentences: SentenceStamp[] = []
  let current: WordStamp[] = []
  let length = 0

  const flush = () => {
    if (!current.length) return
    const first = current[0]
    const last = current[current.length - 1]
    sentences.push({
      start: first.start,
      end: last.end,
      text: current
        .map((w) => w.word.trim())
        .filter(Boolean)
        .join(' ')
        .trim(),
    })
    current = []
    length = 0
  }

  for (const w of words) {
    const word = w.word.trim()
    if (!word) continue
    current.push(w)
    length += word.length + 1
    if (SENTENCE_END.test(word) || length >= maxChars) flush()
  }
  flush()
  return sentences
}