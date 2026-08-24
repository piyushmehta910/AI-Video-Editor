import type { StoredTranscript } from '@/engine/analysis/types'

export type VisemeType =
  | 'A'
  | 'E'
  | 'I'
  | 'O'
  | 'U'
  | 'M_B_P'
  | 'F_V'
  | 'L'
  | 'S_Z'
  | 'TH'
  | 'REST'

export type GestureType =
  | 'neutral'
  | 'point_left'
  | 'point_right'
  | 'point_up'
  | 'explain'
  | 'emphasize'
  | 'nod'
  | 'shake_head'
  | 'think'
  | 'celebrate'
  | 'count_fingers'

export interface WordTimelineEntry {
  id: string
  word: string
  start: number
  end: number
  duration: number
  confidence: number
  viseme: VisemeType
  gesture: GestureType
  isEmphasis: boolean
  intensity: number // 0.0 to 1.0
  sentenceIndex: number
}

export interface WordTimelineMasterClock {
  assetId?: string
  totalDuration: number
  words: WordTimelineEntry[]
  sentences: Array<{
    text: string
    start: number
    end: number
    wordStartIndex: number
    wordEndIndex: number
    sentiment?: 'positive' | 'negative' | 'neutral'
  }>
  emphasisMoments: Array<{ time: number; word: string; intensity: number }>
}

/**
 * Phoneme / Viseme mapper
 * Maps word syllables & characters to primary mouth viseme shapes:
 * - A: Open mouth (as in cat, father)
 * - E: Wide open (as in see, meet)
 * - I: Narrow (as in sit, bit)
 * - O: Rounded (as in go, home)
 * - U: Pursed (as in blue, you)
 * - M_B_P: Closed lips (as in mom, boy, pop)
 * - F_V: Lower lip to upper teeth (as in fun, very)
 * - L: Tongue to upper teeth (as in let, like)
 * - S_Z: Slightly open hiss (as in sun, zoo)
 * - TH: Tongue between teeth (as in think, the)
 * - REST: Closed rest state
 */
export function mapWordToViseme(word: string): VisemeType {
  const clean = word.toLowerCase().replace(/[^a-z]/g, '')
  if (!clean) return 'REST'

  // Special onsets & digraphs
  if (clean.startsWith('th') || clean.includes('th')) return 'TH'
  if (clean.startsWith('f') || clean.startsWith('v')) return 'F_V'
  if (clean.startsWith('s') || clean.startsWith('z')) return 'S_Z'
  if (clean.startsWith('l')) return 'L'

  // Vowel openness phonemes
  if (clean.includes('oo') || clean.includes('ue') || clean.includes('ew') || clean.includes('u') || clean.includes('w')) return 'U'
  if (clean.includes('o') || clean.includes('au') || clean.includes('aw')) return 'O'
  if (clean.includes('ee') || clean.includes('ea') || clean.includes('y')) return 'E'
  if (clean.includes('i') || clean.includes('ai') || clean.includes('ay')) return 'I'
  if (clean.includes('a')) return 'A'
  if (clean.includes('e')) return 'E'

  if (['m', 'b', 'p'].includes(clean[0]) || ['m', 'b', 'p'].includes(clean[clean.length - 1])) return 'M_B_P'

  return 'REST'
}

/**
 * Detect gesture recommendation from word context and semantic keywords
 */
export function mapWordToGesture(word: string, nextWords: string[] = []): GestureType {
  const clean = word.toLowerCase().replace(/[^a-z]/g, '')
  const combined = [clean, ...nextWords.map((w) => w.toLowerCase().replace(/[^a-z]/g, ''))].join(' ')

  if (['first', 'second', 'third', '1', '2', '3', 'step', 'one', 'two', 'three'].includes(clean)) {
    return 'count_fingers'
  }
  if (['on the other hand', 'versus', 'instead', 'however', 'alternatively'].some((p) => combined.includes(p))) {
    return 'point_left'
  }
  if (['right here', 'next', 'following', 'look at'].some((p) => combined.includes(p))) {
    return 'point_right'
  }
  if (['look up', 'above', 'top', 'growth', 'increase', 'skyrocket'].some((p) => combined.includes(p))) {
    return 'point_up'
  }
  if (['crucial', 'important', 'key', 'remember', 'warning', 'essential', 'must'].includes(clean)) {
    return 'emphasize'
  }
  if (['why', 'how', 'imagine', 'suppose', 'think', 'wonder'].includes(clean)) {
    return 'think'
  }
  if (['amazing', 'success', 'win', 'congratulations', 'revolution', 'breakthrough'].includes(clean)) {
    return 'celebrate'
  }
  if (['yes', 'exactly', 'correct', 'agree', 'indeed'].includes(clean)) {
    return 'nod'
  }
  if (['no', 'never', 'avoid', 'wrong', 'mistake'].includes(clean)) {
    return 'shake_head'
  }
  if (clean.length > 4 && ['explain', 'detail', 'process', 'means', 'concept', 'system'].some((k) => clean.includes(k))) {
    return 'explain'
  }

  return 'neutral'
}

/**
 * Construct Master Clock Word Timeline from Transcription
 */
export function createWordTimelineFromTranscript(transcript: StoredTranscript): WordTimelineMasterClock {
  const rawWords = transcript.words || []
  const rawSentences = transcript.sentences || []

  const words: WordTimelineEntry[] = rawWords.map((w, idx) => {
    const wordText = w.word.trim()
    const isEmphasis =
      w.word.toUpperCase() === w.word && w.word.length > 2
        ? true
        : ['crucial', 'huge', 'never', 'must', 'best', 'secret', 'key', 'only'].includes(wordText.toLowerCase())

    const intensity = isEmphasis ? 0.9 : Math.min(1.0, 0.4 + (w.end - w.start) * 0.8)
    const nextThree = rawWords.slice(idx + 1, idx + 4).map((x) => x.word)

    return {
      id: `w-${idx}-${w.start.toFixed(2)}`,
      word: wordText,
      start: w.start,
      end: w.end,
      duration: Math.max(0.05, w.end - w.start),
      confidence: (w as any).confidence ?? 0.95,
      viseme: mapWordToViseme(wordText),
      gesture: mapWordToGesture(wordText, nextThree),
      isEmphasis,
      intensity,
      sentenceIndex: 0,
    }
  })

  // Group into sentences
  const sentences = rawSentences.map((s, sIdx) => {
    let wordStartIndex = words.findIndex((w) => w.start >= s.start - 0.05)
    if (wordStartIndex === -1) wordStartIndex = 0
    let wordEndIndex = words.findLastIndex ? words.findLastIndex((w) => w.end <= s.end + 0.05) : words.length - 1
    if (wordEndIndex === -1) wordEndIndex = words.length - 1

    // Tag sentence index on words
    for (let i = wordStartIndex; i <= wordEndIndex && i < words.length; i++) {
      words[i].sentenceIndex = sIdx
    }

    const textLower = s.text.toLowerCase()
    const sentiment: 'positive' | 'negative' | 'neutral' =
      textLower.includes('great') || textLower.includes('best') || textLower.includes('amazing') || textLower.includes('love')
        ? 'positive'
        : textLower.includes('bad') || textLower.includes('error') || textLower.includes('problem') || textLower.includes('fail')
          ? 'negative'
          : 'neutral'

    return {
      text: s.text.trim(),
      start: s.start,
      end: s.end,
      wordStartIndex,
      wordEndIndex,
      sentiment,
    }
  })

  const totalDuration = words.length > 0 ? words[words.length - 1].end : 0

  const emphasisMoments = words
    .filter((w) => w.isEmphasis || w.intensity > 0.75)
    .map((w) => ({
      time: w.start,
      word: w.word,
      intensity: w.intensity,
    }))

  return {
    assetId: transcript.assetId,
    totalDuration,
    words,
    sentences,
    emphasisMoments,
  }
}

/**
 * Get the active word, viseme, and gesture at any exact playhead timestamp
 */
export function getWordTimelineStateAt(
  clock: WordTimelineMasterClock,
  time: number,
): {
  activeWord: WordTimelineEntry | null
  activeSentence: WordTimelineMasterClock['sentences'][0] | null
  currentViseme: VisemeType
  currentGesture: GestureType
  progressRatioInWord: number
} {
  const activeWord = clock.words.find((w) => time >= w.start && time <= w.end) ?? null
  const activeSentence = clock.sentences.find((s) => time >= s.start && time <= s.end) ?? null

  if (!activeWord) {
    return {
      activeWord: null,
      activeSentence,
      currentViseme: 'REST',
      currentGesture: 'neutral',
      progressRatioInWord: 0,
    }
  }

  const progressRatioInWord = Math.max(
    0,
    Math.min(1, (time - activeWord.start) / Math.max(0.01, activeWord.duration)),
  )

  return {
    activeWord,
    activeSentence,
    currentViseme: activeWord.viseme,
    currentGesture: activeWord.gesture,
    progressRatioInWord,
  }
}
