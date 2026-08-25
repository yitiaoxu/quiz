import { collectDueAndUnseen, remainingNewCount } from '../srs'
import type { BankContainer, Question } from './types'
import { questionsOf } from './containers'
import type { CardState } from '../types'

export function fisherYatesShuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    const left = next[i]
    const right = next[j]
    if (left === undefined || right === undefined) continue
    next[i] = right
    next[j] = left
  }
  return next
}

function sortIdsByPool(ids: string[], pool: Question[]): string[] {
  const order = new Map(pool.map((q, index) => [q.id, q.number * 10_000 + index]))
  return [...ids].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))
}

export type BuildBanksQueueInput = {
  banks: BankContainer[]
  builtinQuestions: Question[]
  progress: Record<string, CardState>
  today: string
  dailyNewLimit: number
  newIntroducedOn: Record<string, string>
  shuffle?: <T>(items: T[]) => T[]
}

export function buildBanksQueue(input: BuildBanksQueueInput): string[] {
  const shuffle = input.shuffle ?? ((items) => fisherYatesShuffle(items))
  let remainingNew = remainingNewCount(
    input.dailyNewLimit,
    input.newIntroducedOn,
    input.today,
  )
  const queue: string[] = []

  for (const bank of input.banks) {
    if (!bank.enabled) continue
    const pool = questionsOf(bank, input.builtinQuestions)
    let { due, unseen } = collectDueAndUnseen(pool, input.progress, input.today)
    if (bank.orderMode === 'sequential') {
      due = sortIdsByPool(due, pool)
      unseen = sortIdsByPool(unseen, pool)
    } else {
      due = shuffle(due)
      unseen = shuffle(unseen)
    }
    const take = unseen.slice(0, remainingNew)
    queue.push(...due, ...take)
    remainingNew -= take.length
  }

  return queue
}
