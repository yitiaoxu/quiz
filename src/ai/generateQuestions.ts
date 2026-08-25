import type { GeneratedDraft } from '../bank/types'

export type { GeneratedDraft }

export function chunkText(text: string, maxChars = 10000): string[] {
  const normalized = text.trim()
  if (!normalized) return []
  if (normalized.length <= maxChars) return [normalized]
  const chunks: string[] = []
  for (let i = 0; i < normalized.length; i += maxChars) {
    chunks.push(normalized.slice(i, i + maxChars))
  }
  return chunks
}

export function extractJsonObject(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = (fenced?.[1] ?? raw).trim()
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('模型没有返回 JSON')
  }
  return JSON.parse(candidate.slice(start, end + 1)) as unknown
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asKeypoints(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map(asString).filter(Boolean)
}

export function parseGeneratedQuestions(raw: string): GeneratedDraft[] {
  const parsed = extractJsonObject(raw)
  const list =
    parsed && typeof parsed === 'object' && 'questions' in parsed
      ? (parsed as { questions: unknown }).questions
      : parsed
  if (!Array.isArray(list)) return []
  const drafts: GeneratedDraft[] = []
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const title = asString(record.title)
    const reference = asString(record.reference)
    if (!title || !reference) continue
    drafts.push({
      chapter: asString(record.chapter) || '自定义',
      title,
      reference,
      keypoints: asKeypoints(record.keypoints),
    })
  }
  return drafts
}

export const GENERATE_SYSTEM_PROMPT = `你是 FPGA/数字IC 面试教练。根据用户提供的学习资料，整理成适合「先默写再对照」的题目。
只输出 JSON，格式：{"questions":[{"chapter":"章节名","title":"短标题","reference":"可对照的参考答案","keypoints":["要点1","要点2"]}]}
要求：
- 每题一个知识点，标题短，像面试题
- reference 覆盖核心定义/对比/步骤/公式，不要整篇抄录
- keypoints 2到6条
- 不要输出 Markdown 以外的解释；JSON 即可`

export function generateUserPrompt(chunk: string, fileName: string): string {
  return `资料文件：${fileName}\n请从下面内容出题：\n\n${chunk}`
}
