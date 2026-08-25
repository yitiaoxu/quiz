import { describe, expect, it } from 'vitest'
import { chatCompletionsUrl } from './openaiCompat'

describe('chatCompletionsUrl', () => {
  it('appends /chat/completions without duplicating v1', () => {
    expect(chatCompletionsUrl('https://api.deepseek.com/v1')).toBe(
      'https://api.deepseek.com/v1/chat/completions',
    )
    expect(chatCompletionsUrl('https://api.openai.com/v1/')).toBe(
      'https://api.openai.com/v1/chat/completions',
    )
  })

  it('keeps a URL that already points at chat completions', () => {
    expect(
      chatCompletionsUrl('https://api.openai.com/v1/chat/completions'),
    ).toBe('https://api.openai.com/v1/chat/completions')
  })
})
