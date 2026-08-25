import { describe, expect, it } from 'vitest'
import { startSession, revealAnswer, rateCurrent, setDraft } from './session'

const kinds = { a: 'new', b: 'due', c: 'new', d: 'new', e: 'due' } as const

describe('session flow', () => {
  it('starts on the first queued card unrevealed', () => {
    const session = startSession(['a', 'b'], { a: 'new', b: 'due' })
    expect(session.currentId).toBe('a')
    expect(session.revealed).toBe(false)
    expect(session.remaining).toEqual(['b'])
  })

  it('does not reveal a blank answer', () => {
    const session = revealAnswer(startSession(['a'], { a: 'new' }))
    expect(session.revealed).toBe(false)
  })

  it('locks the written answer on reveal', () => {
    let session = setDraft(startSession(['a'], { a: 'new' }), '  亚稳态是...  ')
    session = revealAnswer(session)
    expect(session.revealed).toBe(true)
    expect(session.lockedAnswer).toBe('亚稳态是...')
  })

  it('mastered advances to the next card and counts new learned once', () => {
    let session = setDraft(startSession(['a', 'b'], { a: 'new', b: 'due' }), '会')
    session = revealAnswer(session)
    session = rateCurrent(session, 'mastered', 1)
    expect(session.currentId).toBe('b')
    expect(session.revealed).toBe(false)
    expect(session.draft).toBe('')
    expect(session.stats.newLearned).toBe(1)
    expect(session.stats.dueReviewed).toBe(0)
    expect(session.stats.ratings.mastered).toBe(1)
  })

  it('unknown reinserts the card after three remaining items', () => {
    let session = startSession(['a', 'b', 'c', 'd', 'e'], { ...kinds })
    session = revealAnswer(setDraft(session, '不会'))
    session = rateCurrent(session, 'unknown', 1)
    expect(session.currentId).toBe('b')
    expect(session.remaining).toEqual(['c', 'd', 'a', 'e'])
  })

  it('unknown on the last card ends the session', () => {
    let session = startSession(['a'], { a: 'new' })
    session = revealAnswer(setDraft(session, '不会'))
    session = rateCurrent(session, 'unknown', 1)
    expect(session.currentId).toBeNull()
    expect(session.remaining).toEqual([])
  })

  it('counts due/new only on first encounter in the session', () => {
    let session = startSession(['a', 'b'], { a: 'new', b: 'due' })
    session = rateCurrent(revealAnswer(setDraft(session, '不会')), 'unknown', 1)
    session = rateCurrent(revealAnswer(setDraft(session, '还是不会')), 'unknown', 1)
    session = rateCurrent(revealAnswer(setDraft(session, '这次会')), 'fuzzy', 1)
    expect(session.stats.newLearned).toBe(1)
    expect(session.stats.dueReviewed).toBe(1)
    expect(session.stats.ratings.unknown).toBe(2)
    expect(session.stats.ratings.fuzzy).toBe(1)
  })

  it('tracks weak chapters for unknown and fuzzy', () => {
    let session = startSession(['a', 'b'], { a: 'new', b: 'due' })
    session = rateCurrent(revealAnswer(setDraft(session, 'x')), 'unknown', 1)
    session = rateCurrent(revealAnswer(setDraft(session, 'y')), 'fuzzy', 2)
    expect(session.stats.weakByChapter).toEqual({ '1': 1, '2': 1 })
  })
})
