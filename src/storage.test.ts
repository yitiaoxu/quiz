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
})
