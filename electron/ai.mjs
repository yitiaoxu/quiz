export function chatCompletionsUrl(baseUrl) {
  const trimmed = String(baseUrl ?? '').trim().replace(/\/+$/, '')
  if (trimmed.endsWith('/chat/completions')) return trimmed
  return `${trimmed}/chat/completions`
}

export function chunkText(text, maxChars = 10000) {
  const normalized = String(text ?? '').trim()
  if (!normalized) return []
  if (normalized.length <= maxChars) return [normalized]
  const chunks = []
  for (let i = 0; i < normalized.length; i += maxChars) {
    chunks.push(normalized.slice(i, i + maxChars))
  }
  return chunks
}

function extractJsonObject(raw) {
  const fenced = String(raw).match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = (fenced?.[1] ?? raw).trim()
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('模型没有返回 JSON')
  }
  return JSON.parse(candidate.slice(start, end + 1))
}

export function parseGeneratedQuestions(raw) {
  const parsed = extractJsonObject(raw)
  const list = parsed && typeof parsed === 'object' && Array.isArray(parsed.questions)
    ? parsed.questions
    : parsed
  if (!Array.isArray(list)) return []
  const drafts = []
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const title = String(item.title ?? '').trim()
    const reference = String(item.reference ?? '').trim()
    if (!title || !reference) continue
    drafts.push({
      chapter: String(item.chapter ?? '').trim() || '自定义',
      title,
      reference,
      keypoints: Array.isArray(item.keypoints)
        ? item.keypoints.map((x) => String(x).trim()).filter(Boolean)
        : [],
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

export const ANALYZE_SYSTEM_PROMPT = `你是 FPGA/数字IC 面试教练。根据学员的自评与默写摘要，给出中文复习建议。
请包含：1）当前薄弱点 2）建议复习顺序 3）默写中常见缺漏。
不要编造学员没做过的题目。用简洁条目，不要客套。`
