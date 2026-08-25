import { describe, expect, it } from 'vitest'
import { buildProgressSummary } from './analyzeProgress'
import type { Question } from '../types'

const questions: Question[] = [
  {
    id: '1-1',
    chapter: 'FPGA/IC 设计',
    chapterId: 1,
    number: 1,
    title: '什么叫 FPGA',
    reference: 'FPGA 是现场可编程门阵列。'.repeat(40),
    keypoints: ['可重构'],
    incomplete: false,
    hasFigure: false,
  },
  {
    id: '2-1',
    chapter: 'Verilog 语法',
    chapterId: 2,
    number: 1,
    title: '阻塞赋值',
    reference: '用 = 立即更新。',
    keypoints: [],
    incomplete: false,
    hasFigure: false,
  },
]

describe('buildProgressSummary', () => {
  it('counts last ratings by chapter and lists truncated weak items', () => {
    const summary = buildProgressSummary(
      questions,
      {
        '1-1': {
          intervalDays: 1,
          dueDate: '2026-08-25',
          lastAnswer: '一种芯片',
          lastRating: 'fuzzy',
          history: [],
        },
        '2-1': {
          intervalDays: 3,
          dueDate: '2026-08-27',
          lastAnswer: '会',
          lastRating: 'mastered',
          history: [],
        },
      },
      12,
    )
    expect(summary.chapterStats).toEqual([
      { chapter: 'FPGA/IC 设计', unknown: 0, fuzzy: 1, mastered: 0 },
      { chapter: 'Verilog 语法', unknown: 0, fuzzy: 0, mastered: 1 },
    ])
    expect(summary.weakItems).toHaveLength(1)
    expect(summary.weakItems[0]?.title).toBe('什么叫 FPGA')
    expect(summary.weakItems[0]?.referenceExcerpt.length).toBeLessThanOrEqual(400)
  })

  it('omits unseen cards from stats', () => {
    const summary = buildProgressSummary(questions, {}, 12)
    expect(summary.chapterStats).toEqual([])
    expect(summary.weakItems).toEqual([])
  })
})
