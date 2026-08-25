import { requeueUnknown } from './srs'
import type { Rating, SessionKind, SessionStats } from './types'

export type SessionRecord = {
  id: string
  rating: Rating
  answer: string
}

export type Session = {
  remaining: string[]
  currentId: string | null
  draft: string
  revealed: boolean
  lockedAnswer: string
  kinds: Record<string, SessionKind>
  counted: string[]
  stats: SessionStats
  records: SessionRecord[]
}

export function emptyStats(): SessionStats {
  return {
    dueReviewed: 0,
    newLearned: 0,
    ratings: { unknown: 0, fuzzy: 0, mastered: 0 },
    weakByChapter: {},
  }
}

export function startSession(
  queue: string[],
  kinds: Record<string, SessionKind>,
): Session {
  return {
    remaining: queue.slice(1),
    currentId: queue[0] ?? null,
    draft: '',
    revealed: false,
    lockedAnswer: '',
    kinds,
    counted: [],
    stats: emptyStats(),
    records: [],
  }
}

export function setDraft(session: Session, draft: string): Session {
  if (session.revealed) return session
  return { ...session, draft }
}

export function revealAnswer(session: Session): Session {
  if (!session.currentId || session.revealed) return session
  const answer = session.draft.trim()
  if (!answer) return session
  return { ...session, revealed: true, lockedAnswer: answer }
}

export function rateCurrent(
  session: Session,
  rating: Rating,
  chapterId: number,
): Session {
  if (!session.revealed || !session.currentId) return session
  const id = session.currentId
  let remaining = session.remaining
  if (rating === 'unknown') {
    remaining = requeueUnknown(remaining, id)
  }

  const stats: SessionStats = {
    dueReviewed: session.stats.dueReviewed,
    newLearned: session.stats.newLearned,
    ratings: {
      ...session.stats.ratings,
      [rating]: session.stats.ratings[rating] + 1,
    },
    weakByChapter: { ...session.stats.weakByChapter },
  }

  const counted = [...session.counted]
  if (!counted.includes(id)) {
    counted.push(id)
    if (session.kinds[id] === 'due') stats.dueReviewed += 1
    if (session.kinds[id] === 'new') stats.newLearned += 1
  }
  if (rating === 'unknown' || rating === 'fuzzy') {
    const key = String(chapterId)
    stats.weakByChapter[key] = (stats.weakByChapter[key] ?? 0) + 1
  }

  return {
    ...session,
    remaining: remaining.slice(1),
    currentId: remaining[0] ?? null,
    draft: '',
    revealed: false,
    lockedAnswer: '',
    counted,
    stats,
    records: [...session.records, { id, rating, answer: session.lockedAnswer }],
  }
}
