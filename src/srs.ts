import type {
  BuildQueueInput,
  CardState,
  PersistedState,
  Rating,
  RatingEvent,
} from './types'

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function localToday(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function msUntilNextLocalMidnight(now: Date = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return next.getTime() - now.getTime()
}

function nextMasteredInterval(current: number): number {
  if (current <= 1) return 3
  if (current === 3) return 7
  return 15
}

export function applyRating(
  prev: CardState | undefined,
  rating: Rating,
  answer: string,
  today: string,
  at: string = `${today}T12:00:00`,
): CardState {
  let intervalDays: number
  if (rating === 'unknown') {
    intervalDays = 0
  } else if (rating === 'fuzzy') {
    intervalDays = 1
  } else {
    intervalDays = nextMasteredInterval(prev?.intervalDays ?? 0)
  }

  const event: RatingEvent = { at, rating, answer }
  return {
    intervalDays,
    dueDate: addDays(today, intervalDays),
    lastAnswer: answer,
    lastRating: rating,
    history: [...(prev?.history ?? []), event],
  }
}

export function buildQueue(input: BuildQueueInput): string[] {
  const due: string[] = []
  const unseen: string[] = []
  for (const q of input.questions) {
    const state = input.progress[q.id]
    if (!state) {
      unseen.push(q.id)
      continue
    }
    if (state.dueDate <= input.today) {
      due.push(q.id)
    }
  }
  const introducedToday = Object.values(input.newIntroducedOn).filter(
    (date) => date === input.today,
  ).length
  const remainingNew = Math.max(0, input.dailyNewLimit - introducedToday)
  return [...due, ...unseen.slice(0, remainingNew)]
}

export function classifyQueue(
  queue: string[],
  progress: Record<string, CardState>,
): Record<string, 'due' | 'new'> {
  const kinds: Record<string, 'due' | 'new'> = {}
  for (const id of queue) {
    kinds[id] = progress[id] ? 'due' : 'new'
  }
  return kinds
}

export function afterRating(
  persisted: PersistedState,
  id: string,
  rating: Rating,
  answer: string,
  today: string,
): PersistedState {
  const prev = persisted.progress[id]
  const progress = {
    ...persisted.progress,
    [id]: applyRating(prev, rating, answer, today),
  }
  const newIntroducedOn = { ...persisted.newIntroducedOn }
  if (!prev && !newIntroducedOn[id]) {
    newIntroducedOn[id] = today
  }
  return { ...persisted, progress, newIntroducedOn }
}

export function reviewList<T extends { id: string }>(
  questions: T[],
  progress: Record<string, CardState>,
): T[] {
  return questions.filter((q) => {
    const state = progress[q.id]
    return state?.lastRating === 'unknown' || state?.lastRating === 'fuzzy'
  })
}

export function requeueUnknown(
  remaining: string[],
  id: string,
  gap = 3,
): string[] {
  if (remaining.length === 0) return []
  const insertAt = Math.min(gap, remaining.length)
  return [...remaining.slice(0, insertAt), id, ...remaining.slice(insertAt)]
}
