import { describe, expect, it } from 'vitest'
import {
  BUILTIN_BANK_ID,
  LEGACY_IMPORT_ID,
  builtinContainer,
  ensureBanks,
  fileStem,
  importDraftsIntoBanks,
  moveBank,
  patchBank,
  removeBank,
} from './containers'
import type { Question } from './types'

const sample: Question = {
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

describe('fileStem', () => {
  it('uses the file name without extension as the container name', () => {
    expect(fileStem('FPGA数字IC知识手册.pdf')).toBe('FPGA数字IC知识手册')
    expect(fileStem('C:\\\\docs\\\\notes.TXT')).toBe('notes')
  })
})

describe('ensureBanks', () => {
  it('inserts the builtin container when banks are missing', () => {
    const banks = ensureBanks(undefined, undefined, 'FPGA数字IC知识手册')
    expect(banks).toHaveLength(1)
    expect(banks[0]).toMatchObject({
      id: BUILTIN_BANK_ID,
      name: 'FPGA数字IC知识手册',
      builtin: true,
      enabled: true,
      orderMode: 'sequential',
      questions: [],
    })
  })

  it('moves leftover custom questions into a legacy imported container', () => {
    const banks = ensureBanks(undefined, [sample], '手册')
    expect(banks.map((bank) => bank.id)).toEqual([BUILTIN_BANK_ID, LEGACY_IMPORT_ID])
    expect(banks[1]?.questions.map((q) => q.id)).toEqual(['custom-2-1'])
  })

  it('does not duplicate custom questions already stored in a bank', () => {
    const existing = [
      builtinContainer('手册'),
      {
        id: 'imported-notes',
        name: 'notes',
        sourceName: 'notes.pdf',
        builtin: false,
        enabled: true,
        orderMode: 'sequential' as const,
        questions: [sample],
      },
    ]
    const banks = ensureBanks(existing, [sample], '手册')
    expect(banks.filter((bank) => bank.id === LEGACY_IMPORT_ID)).toHaveLength(0)
    expect(banks[1]?.questions).toHaveLength(1)
  })
})

describe('importDraftsIntoBanks', () => {
  it('creates a container named after the file and appends later imports of the same name', () => {
    const first = importDraftsIntoBanks([builtinContainer('手册')], 'notes.pdf', [
      { chapter: '面试补充', title: '第一题', reference: 'A', keypoints: ['a'] },
    ])
    expect(first.added.map((q) => q.id)).toEqual(['bank-imported-notes-1'])
    expect(first.banks[1]?.name).toBe('notes')
    expect(first.banks[1]?.orderMode).toBe('sequential')

    const second = importDraftsIntoBanks(first.banks, 'notes.pdf', [
      { chapter: '面试补充', title: '第二题', reference: 'B', keypoints: [] },
    ])
    expect(second.banks.filter((bank) => bank.name === 'notes')).toHaveLength(1)
    expect(second.added.map((q) => q.id)).toEqual(['bank-imported-notes-2'])
    expect(second.banks[1]?.questions).toHaveLength(2)
  })
})

describe('bank list edits', () => {
  it('moves, patches order mode, and refuses to delete the builtin bank', () => {
    const start = [
      builtinContainer('手册'),
      {
        id: 'imported-notes',
        name: 'notes',
        sourceName: 'notes.pdf',
        builtin: false,
        enabled: true,
        orderMode: 'sequential' as const,
        questions: [],
      },
    ]
    const moved = moveBank(start, 'imported-notes', -1)
    expect(moved.map((bank) => bank.id)).toEqual(['imported-notes', BUILTIN_BANK_ID])
    const shuffled = patchBank(moved, 'imported-notes', { orderMode: 'shuffle' })
    expect(shuffled[0]?.orderMode).toBe('shuffle')
    expect(removeBank(shuffled, BUILTIN_BANK_ID)).toHaveLength(2)
    expect(removeBank(shuffled, 'imported-notes').map((bank) => bank.id)).toEqual([
      BUILTIN_BANK_ID,
    ])
  })
})
