import { describe, expect, it } from 'vitest'
import { defaultPersisted, normalizePersisted } from './storage'

describe('normalizePersisted', () => {
  it('fills missing fields from the default progress file shape', () => {
    expect(normalizePersisted(undefined)).toEqual(defaultPersisted())
    expect(
      normalizePersisted({
        dailyNewLimit: 3,
        customQuestions: [],
      }),
    ).toEqual({
      ...defaultPersisted(),
      dailyNewLimit: 3,
      customQuestions: [],
    })
  })

  it('migrates leftover custom questions into a named imported bank', () => {
    const custom = {
      id: 'custom-2-1',
      chapter: '面试补充',
      chapterId: 2,
      number: 1,
      title: 'CDC',
      reference: '握手',
      keypoints: [],
      incomplete: false,
      hasFigure: false,
    }
    const next = normalizePersisted({ customQuestions: [custom] })
    expect(next.customQuestions).toEqual([])
    expect(next.banks.some((bank) => bank.id === 'imported-legacy')).toBe(true)
    expect(next.banks.find((bank) => bank.id === 'imported-legacy')?.questions).toEqual([custom])
  })
})
