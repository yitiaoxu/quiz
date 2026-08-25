/// <reference types="vite/client" />

interface Window {
  quizZoom?: {
    restore: () => Promise<number>
    bump: (delta: number) => Promise<number>
    reset: () => Promise<number>
    get: () => number
  }
  quizProgress?: {
    load: () => Promise<{
      exists: boolean
      state: import('./types').PersistedState | null
      path: string
    }>
    save: (state: import('./types').PersistedState) => Promise<import('./types').PersistedState>
    path: () => Promise<string>
  }
  quizAi?: {
    configured: () => Promise<boolean>
    getSettings: () => Promise<{
      provider?: string
      baseUrl: string
      model: string
      apiKey?: string
      hasKey: boolean
    }>
    saveSettings: (partial: {
      provider?: string
      baseUrl: string
      model: string
      apiKey?: string
    }) => Promise<void>
    generateFromBuffer: (payload: {
      name: string
      bytes: number[]
    }) => Promise<
      | { ok: true; drafts: import('./bank/types').GeneratedDraft[] }
      | { ok: false; error: string }
    >
    analyze: (
      summary: import('./ai/analyzeProgress').ProgressSummary,
    ) => Promise<{ ok: true; text: string } | { ok: false; error: string }>
  }
}
