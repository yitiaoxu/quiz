export type Question = {
  id: string
  chapter: string
  chapterId: number
  number: number
  title: string
  reference: string
  keypoints: string[]
  incomplete: boolean
  hasFigure: boolean
}

export type QuestionBank = {
  source: string
  questions: Question[]
}

export type GeneratedDraft = {
  chapter: string
  title: string
  reference: string
  keypoints: string[]
}

export type CustomQuestionInput = {
  chapter: string
  title: string
  reference: string
  keypointsText?: string
}
