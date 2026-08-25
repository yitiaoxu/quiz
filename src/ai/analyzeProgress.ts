import type { CardState, Question, Rating } from '../types'

export type ChapterStat = {
  chapter: string
  unknown: number
  fuzzy: number
  mastered: number
}

export type WeakItem = {
  title: string
  chapter: string
  lastAnswer: string
  referenceExcerpt: string
  keypoints: string[]
  lastRating: Rating
}

export type ProgressSummary = {
  chapterStats: ChapterStat[]
  weakItems: WeakItem[]
}

function excerpt(text: string, max = 400): string {
  const compact = text.replace(/\s+/g, ' ').trim()
  if (compact.length <= max) return compact
  return `${compact.slice(0, max)}…`
}

export function buildProgressSummary(
  questions: Question[],
  progress: Record<string, CardState>,
  maxWeak = 12,
): ProgressSummary {
  const stats = new Map<string, ChapterStat>()
  const weakItems: WeakItem[] = []

  for (const question of questions) {
    const state = progress[question.id]
    if (!state) continue
    const current = stats.get(question.chapter) ?? {
      chapter: question.chapter,
      unknown: 0,
      fuzzy: 0,
      mastered: 0,
    }
    current[state.lastRating] += 1
    stats.set(question.chapter, current)
    if (state.lastRating === 'unknown' || state.lastRating === 'fuzzy') {
      weakItems.push({
        title: question.title,
        chapter: question.chapter,
        lastAnswer: excerpt(state.lastAnswer, 300),
        referenceExcerpt: excerpt(question.keypoints.join('；') || question.reference, 400),
        keypoints: question.keypoints.slice(0, 6),
        lastRating: state.lastRating,
      })
    }
  }

  return {
    chapterStats: [...stats.values()],
    weakItems: weakItems.slice(0, maxWeak),
  }
}

export const ANALYZE_SYSTEM_PROMPT = `你是 FPGA/数字IC 面试教练。根据学员的自评与默写摘要，给出中文复习建议。
请包含：1）当前薄弱点 2）建议复习顺序 3）默写中常见缺漏。
不要编造学员没做过的题目。用简洁条目，不要客套。`

export function analyzeUserPrompt(summary: ProgressSummary): string {
  return JSON.stringify(summary, null, 2)
}
