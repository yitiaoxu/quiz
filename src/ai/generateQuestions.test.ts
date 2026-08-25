import { describe, expect, it } from 'vitest'
import { chunkText, parseGeneratedQuestions } from './generateQuestions'

describe('chunkText', () => {
  it('returns a single chunk when text is short', () => {
    expect(chunkText('hello', 10)).toEqual(['hello'])
  })

  it('splits long text into max-sized pieces', () => {
    expect(chunkText('abcdefghij', 4)).toEqual(['abcd', 'efgh', 'ij'])
  })
})

describe('parseGeneratedQuestions', () => {
  it('reads a questions array from model JSON', () => {
    const drafts = parseGeneratedQuestions(
      JSON.stringify({
        questions: [
          {
            chapter: '验证',
            title: '什么是 UVM',
            reference: '通用验证方法学',
            keypoints: ['类库', '可重用'],
          },
        ],
      }),
    )
    expect(drafts).toEqual([
      {
        chapter: '验证',
        title: '什么是 UVM',
        reference: '通用验证方法学',
        keypoints: ['类库', '可重用'],
      },
    ])
  })

  it('extracts JSON from a markdown fence and skips empty titles', () => {
    const raw = '好的\n```json\n{"questions":[{"title":"","reference":"x"},{"title":"亚稳态","reference":"建立保持违例","chapter":"FPGA/IC 设计","keypoints":["违例"]}]}\n```'
    const drafts = parseGeneratedQuestions(raw)
    expect(drafts).toHaveLength(1)
    expect(drafts[0]?.title).toBe('亚稳态')
  })
})
