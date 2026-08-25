import { describe, expect, it } from 'vitest'
import { addDays, afterRating, applyRating, buildQueue, localToday, msUntilNextLocalMidnight, reviewList, requeueUnknown } from './srs'
import type { CardState, QuestionSummary } from './types'

const today = '2026-08-24'

function card(partial: Partial<CardState> = {}): CardState {
  return {
    intervalDays: 0,
    dueDate: today,
    lastAnswer: '',
    lastRating: 'unknown',
    history: [],
    ...partial,
  }
}

describe('addDays', () => {
  it('adds calendar days without UTC shifting the date', () => {
    expect(addDays('2026-08-24', 1)).toBe('2026-08-25')
    expect(addDays('2026-08-24', 3)).toBe('2026-08-27')
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02')
  })
})

describe('local clock', () => {
  it('formats the computer local date', () => {
    expect(localToday(new Date(2026, 7, 24, 23, 50))).toBe('2026-08-24')
    expect(localToday(new Date(2026, 7, 25, 0, 1))).toBe('2026-08-25')
  })

  it('counts milliseconds until the next local midnight', () => {
    const now = new Date(2026, 7, 24, 23, 59, 0)
    expect(msUntilNextLocalMidnight(now)).toBe(60_000)
  })
})

describe('applyRating', () => {
  it('marks unknown as due today with interval 0', () => {
    const next = applyRating(undefined, 'unknown', '说不上来', today)
    expect(next.intervalDays).toBe(0)
    expect(next.dueDate).toBe(today)
    expect(next.lastAnswer).toBe('说不上来')
    expect(next.lastRating).toBe('unknown')
  })

  it('marks fuzzy as due tomorrow with interval 1', () => {
    const next = applyRating(undefined, 'fuzzy', '大概记得', today)
    expect(next.intervalDays).toBe(1)
    expect(next.dueDate).toBe('2026-08-25')
  })

  it('first mastered from a new card becomes 3 days', () => {
    const next = applyRating(undefined, 'mastered', '会', today)
    expect(next.intervalDays).toBe(3)
    expect(next.dueDate).toBe('2026-08-27')
  })

  it('consecutive mastered upgrades 3 to 7 then 15 and stays at 15', () => {
    let state = applyRating(undefined, 'mastered', 'a', today)
    state = applyRating(state, 'mastered', 'b', '2026-08-27')
    expect(state.intervalDays).toBe(7)
    expect(state.dueDate).toBe('2026-09-03')
    state = applyRating(state, 'mastered', 'c', '2026-09-03')
    expect(state.intervalDays).toBe(15)
    state = applyRating(state, 'mastered', 'd', '2026-09-18')
    expect(state.intervalDays).toBe(15)
  })

  it('fuzzy after mastered resets to 1 day', () => {
    let state = applyRating(undefined, 'mastered', 'a', today)
    state = applyRating(state, 'fuzzy', 'b', '2026-08-27')
    expect(state.intervalDays).toBe(1)
    expect(state.dueDate).toBe('2026-08-28')
  })

  it('consecutive fuzzy stays at 1 day', () => {
    let state = applyRating(undefined, 'fuzzy', 'a', today)
    state = applyRating(state, 'fuzzy', 'b', '2026-08-25')
    expect(state.intervalDays).toBe(1)
    expect(state.dueDate).toBe('2026-08-26')
  })

  it('unknown after mastered resets to due today', () => {
    let state = applyRating(undefined, 'mastered', 'a', today)
    state = applyRating(state, 'unknown', '忘了', '2026-08-27')
    expect(state.intervalDays).toBe(0)
    expect(state.dueDate).toBe('2026-08-27')
  })

  it('appends rating history', () => {
    const state = applyRating(undefined, 'fuzzy', '要点不全', today, '2026-08-24T10:00:00')
    expect(state.history).toEqual([
      { at: '2026-08-24T10:00:00', rating: 'fuzzy', answer: '要点不全' },
    ])
  })
})

describe('buildQueue', () => {
  const questions: QuestionSummary[] = [
    { id: '1-1', chapterId: 1 },
    { id: '1-2', chapterId: 1 },
    { id: '2-1', chapterId: 2 },
  ]

  it('puts due cards before new cards', () => {
    const queue = buildQueue({
      questions,
      progress: {
        '1-2': card({ intervalDays: 1, dueDate: today }),
      },
      today,
      dailyNewLimit: 10,
      newIntroducedOn: {},
    })
    expect(queue[0]).toBe('1-2')
    expect(queue.slice(1)).toEqual(['1-1', '2-1'])
  })

  it('includes overdue cards and skips future cards', () => {
    const queue = buildQueue({
      questions,
      progress: {
        '1-1': card({ intervalDays: 3, dueDate: '2026-08-20' }),
        '1-2': card({ intervalDays: 3, dueDate: '2026-08-30' }),
      },
      today,
      dailyNewLimit: 0,
      newIntroducedOn: {},
    })
    expect(queue).toEqual(['1-1'])
  })

  it('respects daily new-card limit', () => {
    const queue = buildQueue({
      questions,
      progress: {},
      today,
      dailyNewLimit: 1,
      newIntroducedOn: {},
    })
    expect(queue).toEqual(['1-1'])
  })

  it('subtracts cards already introduced today from the new quota', () => {
    const queue = buildQueue({
      questions,
      progress: {
        '1-1': card({ intervalDays: 3, dueDate: '2026-08-27', lastRating: 'mastered' }),
      },
      today,
      dailyNewLimit: 1,
      newIntroducedOn: { '1-1': today },
    })
    expect(queue).toEqual([])
  })

  it('uses the whole bank without chapter partitions', () => {
    const queue = buildQueue({
      questions,
      progress: {},
      today,
      dailyNewLimit: 10,
      newIntroducedOn: {},
    })
    expect(queue).toEqual(['1-1', '1-2', '2-1'])
  })
})

describe('afterRating', () => {
  it('writes progress and marks a first-seen card as introduced today', () => {
    const next = afterRating(
      {
        progress: {},
        newIntroducedOn: {},
        dailyNewLimit: 10,
        selectedChapterIds: [1],
        customQuestions: [],
      },
      '1-1',
      'mastered',
      '会',
      today,
    )
    expect(next.progress['1-1']?.intervalDays).toBe(3)
    expect(next.newIntroducedOn['1-1']).toBe(today)
  })

  it('does not overwrite an earlier introduction date', () => {
    const next = afterRating(
      {
        progress: {
          '1-1': card({ intervalDays: 0, lastRating: 'unknown' }),
        },
        newIntroducedOn: { '1-1': '2026-08-20' },
        dailyNewLimit: 10,
        selectedChapterIds: [1],
        customQuestions: [],
      },
      '1-1',
      'fuzzy',
      '差不多',
      today,
    )
    expect(next.newIntroducedOn['1-1']).toBe('2026-08-20')
    expect(next.progress['1-1']?.lastRating).toBe('fuzzy')
  })
})

describe('reviewList', () => {
  it('keeps only cards last rated unknown or fuzzy', () => {
    const questions = [{ id: '1-1' }, { id: '1-2' }, { id: '1-3' }]
    const listed = reviewList(questions, {
      '1-1': card({ lastRating: 'unknown' }),
      '1-2': card({ lastRating: 'mastered' }),
      '1-3': card({ lastRating: 'fuzzy' }),
    })
    expect(listed.map((q) => q.id)).toEqual(['1-1', '1-3'])
  })
})

describe('requeueUnknown', () => {
  it('inserts the card after three remaining cards', () => {
    expect(requeueUnknown(['b', 'c', 'd', 'e'], 'a', 3)).toEqual(['b', 'c', 'd', 'a', 'e'])
  })

  it('appends when fewer than three remain', () => {
    expect(requeueUnknown(['b'], 'a', 3)).toEqual(['b', 'a'])
  })

  it('does not requeue when the session has no remaining cards', () => {
    expect(requeueUnknown([], 'a', 3)).toEqual([])
  })
})
