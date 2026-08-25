import bank from '../../bank/questions.json'
import type { Question, QuestionBank } from './types'

const payload = bank as QuestionBank

export const builtinQuestions: Question[] = payload.questions
export const builtinSource: string = payload.source
