import { describe, expect, it } from 'vitest'
import type { BankContainer, Question } from './types'
import { builtinContainer } from './containers'
import { buildBanksQueue } from './queue'

const questions: Question[] = [
  {
    id: '1-1',
    chapter: 'A',
    chapterId: 1,
    number: 1,
    title: '一',
    reference: '1',
    keypoints: [],
    incomplete: false,
    hasFigure: false,
  },
  {
    id: '1-2',
    chapter: 'A',
    chapterId: 1,
    number: 2,
    title: '二',
    reference: '2',
    keypoints: [],
    incomplete: false,
    hasFigure: false,
  },
  {
    id: '1-3',
    chapter: 'A',
    chapterId: 1,
    number: 3,
    title: '三',
    reference: '3',
    keypoints: [],
    incomplete: false,
    hasFigure: false,
  },
]

const imported: Question[] = [
  {
    id: 'bank-imported-notes-1',
    chapter: 'B',
    chapterId: 2,
    number: 1,
    title: '导入一',
    reference: 'x',
    keypoints: [],
    incomplete: false,
    hasFigure: false,
  },
]

function bank(overrides: Partial<BankContainer> = {}): BankContainer {
  return {
    ...builtinContainer('手册'),
    ...overrides,
  }
}

describe('buildBanksQueue', () => {
  it('walks enabled banks in list order and keeps due before new', () => {
    const queue = buildBanksQueue({
      banks: [
        bank({ enabled: true, orderMode: 'sequential' }),
        {
          id: 'imported-notes',
          name: 'notes',
          sourceName: 'notes.pdf',
          builtin: false,
          enabled: true,
          orderMode: 'sequential',
          questions: imported,
        },
      ],
      builtinQuestions: questions,
      progress: {
        '1-2': {
          intervalDays: 1,
          dueDate: '2026-08-24',
          lastAnswer: '',
          lastRating: 'fuzzy',
          history: [],
        },
      },
      today: '2026-08-24',
      dailyNewLimit: 1,
      newIntroducedOn: {},
    })
    expect(queue).toEqual(['1-2', '1-1'])
  })

  it('skips disabled banks', () => {
    const queue = buildBanksQueue({
      banks: [bank({ enabled: false })],
      builtinQuestions: questions,
      progress: {},
      today: '2026-08-24',
      dailyNewLimit: 10,
      newIntroducedOn: {},
    })
    expect(queue).toEqual([])
  })

  it('uses injected shuffle only for shuffle mode and does not rewrite progress', () => {
    const progress = {
      '1-1': {
        intervalDays: 1,
        dueDate: '2026-08-24',
        lastAnswer: 'a',
        lastRating: 'fuzzy' as const,
        history: [],
      },
      '1-2': {
        intervalDays: 1,
        dueDate: '2026-08-24',
        lastAnswer: 'b',
        lastRating: 'fuzzy' as const,
        history: [],
      },
    }
    const sequential = buildBanksQueue({
      banks: [bank({ orderMode: 'sequential' })],
      builtinQuestions: questions,
      progress,
      today: '2026-08-24',
      dailyNewLimit: 1,
      newIntroducedOn: {},
    })
    const shuffled = buildBanksQueue({
      banks: [bank({ orderMode: 'shuffle' })],
      builtinQuestions: questions,
      progress,
      today: '2026-08-24',
      dailyNewLimit: 1,
      newIntroducedOn: {},
      shuffle: (items) => [...items].reverse(),
    })
    expect(sequential).toEqual(['1-1', '1-2', '1-3'])
    expect(shuffled).toEqual(['1-2', '1-1', '1-3'])
    expect(progress['1-1']?.dueDate).toBe('2026-08-24')
  })

  it('lets later unseen cards become new after switching to shuffle', () => {
    const progress = {}
    const sequential = buildBanksQueue({
      banks: [bank({ orderMode: 'sequential' })],
      builtinQuestions: questions,
      progress,
      today: '2026-08-24',
      dailyNewLimit: 1,
      newIntroducedOn: {},
    })
    const shuffled = buildBanksQueue({
      banks: [bank({ orderMode: 'shuffle' })],
      builtinQuestions: questions,
      progress,
      today: '2026-08-24',
      dailyNewLimit: 1,
      newIntroducedOn: {},
      shuffle: (items) => [...items].reverse(),
    })
    expect(sequential).toEqual(['1-1'])
    expect(shuffled).toEqual(['1-3'])
  })
})
