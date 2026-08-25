import { describe, expect, it } from 'vitest'
import {
  addCustomQuestion,
  chapterIdsFrom,
  importGeneratedQuestions,
  mergeQuestions,
} from './catalog'
import type { Question } from './types'

const builtin: Question[] = [
  {
    id: '1-1',
    chapter: 'FPGA/IC 设计',
    chapterId: 1,
    number: 1,
    title: '什么叫 FPGA',
    reference: '现场可编程门阵列',
    keypoints: [],
    incomplete: false,
    hasFigure: false,
  },
]

describe('chapterIdsFrom', () => {
  it('collects unique chapter ids from whatever bank is loaded', () => {
    expect(
      chapterIdsFrom([
        { chapterId: 3 },
        { chapterId: 1 },
        { chapterId: 3 },
      ]),
    ).toEqual([1, 3])
    expect(chapterIdsFrom([])).toEqual([])
  })
})

describe('addCustomQuestion', () => {
  it('appends to an existing chapter with the next number', () => {
    const created = addCustomQuestion(builtin, {
      chapter: 'FPGA/IC 设计',
      title: '我加的题',
      reference: '自定义参考答案',
      keypointsText: '要点一\n要点二',
    })
    expect(created.chapterId).toBe(1)
    expect(created.number).toBe(2)
    expect(created.id).toBe('custom-1-2')
    expect(created.keypoints).toEqual(['要点一', '要点二'])
    expect(created.incomplete).toBe(false)
  })

  it('opens a new chapter when the name is unknown', () => {
    const created = addCustomQuestion(builtin, {
      chapter: '面试补充',
      title: '新章第一题',
      reference: '答案',
    })
    expect(created.chapterId).toBe(2)
    expect(created.number).toBe(1)
    expect(created.id).toBe('custom-2-1')
  })
})

describe('importGeneratedQuestions', () => {
  it('imports selected drafts with sequential custom ids', () => {
    const added = importGeneratedQuestions(builtin, [
      { chapter: '面试补充', title: '第一题', reference: 'A', keypoints: ['a'] },
      { chapter: '面试补充', title: '第二题', reference: 'B', keypoints: [] },
    ])
    expect(added.map((q) => q.id)).toEqual(['custom-2-1', 'custom-2-2'])
    expect(added[0]?.keypoints).toEqual(['a'])
  })
})

describe('mergeQuestions', () => {
  it('keeps handbook questions first and custom questions after', () => {
    const custom = addCustomQuestion(builtin, {
      chapter: '面试补充',
      title: '新章第一题',
      reference: '答案',
    })
    expect(mergeQuestions(builtin, [custom]).map((q) => q.id)).toEqual(['1-1', 'custom-2-1'])
  })
})
