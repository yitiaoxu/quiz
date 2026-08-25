import { describe, expect, it } from 'vitest'
import {
  CUSTOM_PROVIDER,
  DEFAULT_MODEL,
  DEFAULT_PROVIDER,
  PROVIDERS,
  resolveProvider,
  settingsForProvider,
} from './providers'

describe('providers catalog', () => {
  it('defaults to DeepSeek V4 Flash and lists official open chat ids', () => {
    expect(DEFAULT_PROVIDER.id).toBe('deepseek')
    expect(DEFAULT_MODEL).toBe('deepseek-v4-flash')
    expect(DEFAULT_PROVIDER.models.map((item) => item.id)).toEqual([
      'deepseek-v4-flash',
      'deepseek-v4-pro',
    ])
    expect(PROVIDERS.flatMap((item) => item.models.map((model) => model.id))).not.toContain(
      'deepseek-chat',
    )
  })

  it('recognizes a saved preset by provider and model', () => {
    expect(
      resolveProvider({
        provider: 'qwen',
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        model: 'qwen-plus',
      }),
    ).toEqual({
      provider: 'qwen',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      model: 'qwen-plus',
    })
  })

  it('infers DeepSeek from an old file that only has baseUrl and a current model id', () => {
    expect(
      resolveProvider({
        baseUrl: 'https://api.deepseek.com',
        model: 'deepseek-v4-pro',
      }),
    ).toEqual({
      provider: 'deepseek',
      baseUrl: 'https://api.deepseek.com/v1',
      model: 'deepseek-v4-pro',
    })
  })

  it('still matches another vendor by URL when a leftover provider field is wrong', () => {
    expect(
      resolveProvider({
        provider: 'deepseek',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-5.6-sol',
      }),
    ).toEqual({
      provider: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-5.6-sol',
    })
  })

  it('falls back to custom when the saved model is no longer in the open list', () => {
    expect(
      resolveProvider({
        provider: 'deepseek',
        baseUrl: 'https://api.deepseek.com/v1',
        model: 'deepseek-chat',
      }),
    ).toEqual({
      provider: CUSTOM_PROVIDER,
      baseUrl: 'https://api.deepseek.com/v1',
      model: 'deepseek-chat',
    })
  })

  it('switches to the first official model of another vendor', () => {
    expect(settingsForProvider('openai')).toEqual({
      provider: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-5.6-sol',
    })
  })
})
