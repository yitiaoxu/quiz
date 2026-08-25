import type { CustomQuestionInput, GeneratedDraft, Question } from './types'

export function chapterIdsFrom(questions: Array<{ chapterId: number }>): number[] {
  return [...new Set(questions.map((q) => q.chapterId))].sort((a, b) => a - b)
}

export function addCustomQuestion(
  existing: Question[],
  input: CustomQuestionInput,
): Question {
  const chapter = input.chapter.trim()
  const title = input.title.trim()
  const reference = input.reference.trim()
  const inChapter = existing.filter((q) => q.chapter === chapter)
  const chapterId =
    inChapter[0]?.chapterId ??
    Math.max(0, ...existing.map((q) => q.chapterId), 0) + 1
  const number = Math.max(0, ...inChapter.map((q) => q.number), 0) + 1
  const keypoints = (input.keypointsText ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  return {
    id: `custom-${chapterId}-${number}`,
    chapter,
    chapterId,
    number,
    title,
    reference,
    keypoints,
    incomplete: reference === '',
    hasFigure: false,
  }
}

export function mergeQuestions(builtin: Question[], custom: Question[]): Question[] {
  return [...builtin, ...custom]
}

export function importGeneratedQuestions(
  existing: Question[],
  drafts: GeneratedDraft[],
): Question[] {
  const current = [...existing]
  const added: Question[] = []
  for (const draft of drafts) {
    const created = addCustomQuestion(current, {
      chapter: draft.chapter,
      title: draft.title,
      reference: draft.reference,
      keypointsText: draft.keypoints.join('\n'),
    })
    current.push(created)
    added.push(created)
  }
  return added
}
