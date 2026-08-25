import type { BankContainer, BankOrderMode, GeneratedDraft, Question } from './types'

export const BUILTIN_BANK_ID = 'builtin'
export const LEGACY_IMPORT_ID = 'imported-legacy'
export const LEGACY_IMPORT_NAME = '已导入'

export function parseOrderMode(value: unknown): BankOrderMode {
  return value === 'shuffle' ? 'shuffle' : 'sequential'
}

export function fileStem(fileName: string): string {
  const base = fileName.replace(/^.*[/\\]/, '').trim()
  const stem = base.replace(/\.[^.]+$/, '')
  return stem || base || '未命名'
}

export function importedContainerId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/gi, '-')
    .replace(/^-+|-+$/g, '')
  return `imported-${slug || 'untitled'}`
}

export function builtinContainer(sourceName: string): BankContainer {
  const name = sourceName.trim() || '内置手册'
  return {
    id: BUILTIN_BANK_ID,
    name,
    sourceName: name,
    builtin: true,
    enabled: true,
    orderMode: 'sequential',
    questions: [],
  }
}

function isQuestion(value: unknown): value is Question {
  if (!value || typeof value !== 'object') return false
  const q = value as Question
  return typeof q.id === 'string' && typeof q.title === 'string'
}

export function normalizeContainer(raw: unknown, index: number): BankContainer | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Partial<BankContainer>
  const builtin = Boolean(item.builtin) || item.id === BUILTIN_BANK_ID
  const name =
    String(item.name ?? '').trim() || (builtin ? '内置手册' : `容器${index + 1}`)
  const questions = Array.isArray(item.questions) ? item.questions.filter(isQuestion) : []
  return {
    id: String(item.id ?? (builtin ? BUILTIN_BANK_ID : importedContainerId(name))),
    name,
    sourceName: String(item.sourceName ?? name),
    builtin,
    enabled: item.enabled !== false,
    orderMode: parseOrderMode(item.orderMode),
    questions: builtin ? [] : questions,
  }
}

export function ensureBanks(
  banks: unknown,
  customQuestions: unknown,
  builtinSource: string,
): BankContainer[] {
  const fromFile = Array.isArray(banks)
    ? banks
        .map((item, index) => normalizeContainer(item, index))
        .filter((item): item is BankContainer => item !== null)
    : []

  let next = fromFile.some((bank) => bank.builtin || bank.id === BUILTIN_BANK_ID)
    ? fromFile.map((bank) =>
        bank.builtin || bank.id === BUILTIN_BANK_ID
          ? {
              ...builtinContainer(builtinSource),
              name: bank.name || builtinSource,
              sourceName: bank.sourceName || builtinSource,
              enabled: bank.enabled,
              orderMode: bank.orderMode,
            }
          : bank,
      )
    : [builtinContainer(builtinSource), ...fromFile]

  const customs = Array.isArray(customQuestions) ? customQuestions.filter(isQuestion) : []
  const existingIds = new Set(next.flatMap((bank) => bank.questions.map((q) => q.id)))
  const leftover = customs.filter((q) => !existingIds.has(q.id))
  if (leftover.length === 0) return next

  const legacyIndex = next.findIndex((bank) => bank.id === LEGACY_IMPORT_ID)
  if (legacyIndex >= 0) {
    const legacy = next[legacyIndex]
    next = next.map((bank, index) =>
      index === legacyIndex ? { ...legacy, questions: [...legacy.questions, ...leftover] } : bank,
    )
    return next
  }

  return [
    ...next,
    {
      id: LEGACY_IMPORT_ID,
      name: LEGACY_IMPORT_NAME,
      sourceName: LEGACY_IMPORT_NAME,
      builtin: false,
      enabled: true,
      orderMode: 'sequential',
      questions: leftover,
    },
  ]
}

export function questionsOf(bank: BankContainer, builtinQuestions: Question[]): Question[] {
  return bank.builtin ? builtinQuestions : bank.questions
}

export function allQuestionsFromBanks(
  banks: BankContainer[],
  builtinQuestions: Question[],
): Question[] {
  return banks.flatMap((bank) => questionsOf(bank, builtinQuestions))
}

function nextImportedNumber(existing: Question[]): number {
  const nums = existing.map((q) => q.number)
  return Math.max(0, ...nums, 0) + 1
}

function questionFromDraft(
  existing: Question[],
  containerId: string,
  draft: GeneratedDraft,
): Question {
  const chapter = draft.chapter.trim() || '导入'
  const inChapter = existing.filter((q) => q.chapter === chapter)
  const chapterId =
    inChapter[0]?.chapterId ?? Math.max(0, ...existing.map((q) => q.chapterId), 0) + 1
  const number = nextImportedNumber(existing)
  const reference = draft.reference.trim()
  return {
    id: `bank-${containerId}-${number}`,
    chapter,
    chapterId,
    number,
    title: draft.title.trim(),
    reference,
    keypoints: draft.keypoints.map((point) => point.trim()).filter(Boolean),
    incomplete: reference === '',
    hasFigure: false,
  }
}

export function importDraftsIntoBanks(
  banks: BankContainer[],
  fileName: string,
  drafts: GeneratedDraft[],
): { banks: BankContainer[]; added: Question[] } {
  const name = fileStem(fileName)
  const sourceName = fileName.replace(/^.*[/\\]/, '') || name
  let next = [...banks]
  let index = next.findIndex((bank) => !bank.builtin && bank.name === name)
  if (index < 0) {
    next.push({
      id: uniqueImportedId(next, name),
      name,
      sourceName,
      builtin: false,
      enabled: true,
      orderMode: 'sequential',
      questions: [],
    })
    index = next.length - 1
  }

  const bank = next[index]
  const added: Question[] = []
  let current = [...bank.questions]
  for (const draft of drafts) {
    const created = questionFromDraft(current, bank.id, draft)
    current.push(created)
    added.push(created)
  }
  next[index] = { ...bank, questions: current }
  return { banks: next, added }
}

function uniqueImportedId(banks: BankContainer[], name: string): string {
  const base = importedContainerId(name)
  if (!banks.some((bank) => bank.id === base)) return base
  let n = 2
  while (banks.some((bank) => bank.id === `${base}-${n}`)) n += 1
  return `${base}-${n}`
}

export function moveBank(
  banks: BankContainer[],
  id: string,
  direction: -1 | 1,
): BankContainer[] {
  const index = banks.findIndex((bank) => bank.id === id)
  const swapWith = index + direction
  if (index < 0 || swapWith < 0 || swapWith >= banks.length) return banks
  const next = [...banks]
  const left = next[index]
  const right = next[swapWith]
  if (!left || !right) return banks
  next[index] = right
  next[swapWith] = left
  return next
}

export function patchBank(
  banks: BankContainer[],
  id: string,
  patch: Partial<Pick<BankContainer, 'enabled' | 'orderMode'>>,
): BankContainer[] {
  return banks.map((bank) => (bank.id === id ? { ...bank, ...patch } : bank))
}

export function removeBank(banks: BankContainer[], id: string): BankContainer[] {
  return banks.filter((bank) => bank.builtin || bank.id !== id)
}
