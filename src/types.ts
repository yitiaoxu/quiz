import type { Question } from './bank/types'

export type { Question } from './bank/types'

export type Rating = 'unknown' | 'fuzzy' | 'mastered'

export type RatingEvent = {
  at: string
  rating: Rating
  answer: string
}

export type CardState = {
  intervalDays: number
  dueDate: string
  lastAnswer: string
  lastRating: Rating
  history: RatingEvent[]
}

export type QuestionSummary = Pick<Question, 'id' | 'chapterId'>

export type BuildQueueInput = {
  questions: QuestionSummary[]
  progress: Record<string, CardState>
  today: string
  dailyNewLimit: number
  newIntroducedOn: Record<string, string>
}

export type SessionKind = 'due' | 'new'

export type SessionStats = {
  dueReviewed: number
  newLearned: number
  ratings: Record<Rating, number>
  weakByChapter: Record<string, number>
}

export type PersistedState = {
  progress: Record<string, CardState>
  newIntroducedOn: Record<string, string>
  dailyNewLimit: number
  selectedChapterIds: number[]
  customQuestions: Question[]
}
