export const CUSTOM_PROVIDER = 'custom' as const

export type ProviderId =
  | 'deepseek'
  | 'openai'
  | 'qwen'
  | 'kimi'
  | 'zhipu'
  | 'siliconflow'
  | 'gemini'
  | typeof CUSTOM_PROVIDER

export type ProviderModel = {
  id: string
  label: string
}

export type ProviderPreset = {
  id: Exclude<ProviderId, typeof CUSTOM_PROVIDER>
  name: string
  baseUrl: string
  aliases?: string[]
  models: ProviderModel[]
}

export const PROVIDERS: ProviderPreset[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    aliases: ['https://api.deepseek.com'],
    models: [
      { id: 'deepseek-v4-flash', label: 'V4 Flash' },
      { id: 'deepseek-v4-pro', label: 'V4 Pro' },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: [
      { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol' },
      { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra' },
      { id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna' },
    ],
  },
  {
    id: 'qwen',
    name: '通义千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: [
      { id: 'qwen3.8-max', label: 'Qwen3.8 Max' },
      { id: 'qwen3.7-plus', label: 'Qwen3.7 Plus' },
      { id: 'qwen3.7-flash', label: 'Qwen3.7 Flash' },
      { id: 'qwen-plus', label: 'Qwen Plus' },
      { id: 'qwen-max', label: 'Qwen Max' },
      { id: 'qwen-flash', label: 'Qwen Flash' },
      { id: 'qwen-turbo', label: 'Qwen Turbo' },
    ],
  },
  {
    id: 'kimi',
    name: 'Kimi',
    baseUrl: 'https://api.moonshot.cn/v1',
    models: [
      { id: 'kimi-k3', label: 'Kimi K3' },
      { id: 'kimi-k2.7-code', label: 'Kimi K2.7 Code' },
      { id: 'kimi-k2.7-code-highspeed', label: 'Kimi K2.7 Code 高速' },
      { id: 'kimi-k2.6', label: 'Kimi K2.6' },
      { id: 'kimi-k2.5', label: 'Kimi K2.5' },
    ],
  },
  {
    id: 'zhipu',
    name: '智谱 GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: [
      { id: 'glm-5.3', label: 'GLM-5.3' },
      { id: 'glm-5.2', label: 'GLM-5.2' },
      { id: 'glm-5.1', label: 'GLM-5.1' },
      { id: 'glm-5', label: 'GLM-5' },
      { id: 'glm-5-turbo', label: 'GLM-5 Turbo' },
      { id: 'glm-4.7', label: 'GLM-4.7' },
      { id: 'glm-4.7-flash', label: 'GLM-4.7 Flash' },
      { id: 'glm-4.6', label: 'GLM-4.6' },
    ],
  },
  {
    id: 'siliconflow',
    name: '硅基流动',
    baseUrl: 'https://api.siliconflow.cn/v1',
    models: [
      { id: 'deepseek-ai/DeepSeek-V4-Flash', label: 'DeepSeek V4 Flash' },
      { id: 'deepseek-ai/DeepSeek-V4-Pro', label: 'DeepSeek V4 Pro' },
      { id: 'deepseek-ai/DeepSeek-V3.2', label: 'DeepSeek V3.2' },
      { id: 'Qwen/Qwen3-32B', label: 'Qwen3 32B' },
      { id: 'Qwen/Qwen3-235B-A22B', label: 'Qwen3 235B' },
    ],
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    aliases: ['https://generativelanguage.googleapis.com/v1beta/openai'],
    models: [
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
      { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite' },
      { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
      { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash' },
    ],
  },
]

export const DEFAULT_PROVIDER = PROVIDERS[0]
export const DEFAULT_MODEL = DEFAULT_PROVIDER.models[0].id

export type SavedLlmSettings = {
  provider?: string
  baseUrl: string
  model: string
}

export type ResolvedLlmSettings = {
  provider: ProviderId
  baseUrl: string
  model: string
}

export function normalizeBaseUrl(url: string) {
  return url
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/chat\/completions$/i, '')
    .replace(/\/+$/, '')
    .toLowerCase()
}

function urlsMatch(left: string, right: string) {
  return normalizeBaseUrl(left) === normalizeBaseUrl(right)
}

export function providerById(id: string) {
  return PROVIDERS.find((item) => item.id === id)
}

function modelInProvider(preset: ProviderPreset, model: string) {
  return preset.models.some((item) => item.id === model)
}

function matchProviderByUrl(baseUrl: string) {
  return PROVIDERS.find(
    (item) =>
      urlsMatch(item.baseUrl, baseUrl) ||
      (item.aliases ?? []).some((alias) => urlsMatch(alias, baseUrl)),
  )
}

export function resolveProvider(saved: SavedLlmSettings): ResolvedLlmSettings {
  const baseUrl = saved.baseUrl.trim() || DEFAULT_PROVIDER.baseUrl
  const model = saved.model.trim() || DEFAULT_MODEL
  const named = saved.provider ? providerById(saved.provider) : undefined

  if (named && modelInProvider(named, model)) {
    return { provider: named.id, baseUrl: named.baseUrl, model }
  }

  const byUrl = matchProviderByUrl(baseUrl)
  if (byUrl && modelInProvider(byUrl, model)) {
    return { provider: byUrl.id, baseUrl: byUrl.baseUrl, model }
  }

  return { provider: CUSTOM_PROVIDER, baseUrl, model }
}

export function settingsForProvider(providerId: ProviderId, model?: string): ResolvedLlmSettings {
  if (providerId === CUSTOM_PROVIDER) {
    return {
      provider: CUSTOM_PROVIDER,
      baseUrl: '',
      model: model ?? '',
    }
  }
  const preset = providerById(providerId) ?? DEFAULT_PROVIDER
  const nextModel =
    model && modelInProvider(preset, model) ? model : preset.models[0].id
  return { provider: preset.id, baseUrl: preset.baseUrl, model: nextModel }
}
