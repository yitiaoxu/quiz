import type { PersistedState } from './types'

export function defaultPersisted(): PersistedState {
  return {
    progress: {},
    newIntroducedOn: {},
    dailyNewLimit: 10,
    selectedChapterIds: [],
    customQuestions: [],
  }
}

export function normalizePersisted(value: Partial<PersistedState> | null | undefined): PersistedState {
  const fallback = defaultPersisted()
  if (!value) return fallback
  const daily = Number(value.dailyNewLimit)
  return {
    progress: value.progress ?? fallback.progress,
    newIntroducedOn: value.newIntroducedOn ?? fallback.newIntroducedOn,
    dailyNewLimit: Number.isFinite(daily) ? Math.max(0, daily) : fallback.dailyNewLimit,
    selectedChapterIds: value.selectedChapterIds ?? fallback.selectedChapterIds,
    customQuestions: value.customQuestions ?? fallback.customQuestions,
  }
}

export type QuizStorage = {
  load: () => Promise<PersistedState>
  save: (state: PersistedState) => Promise<void>
}

export function memoryStorage(initial?: Partial<PersistedState>): QuizStorage {
  let state: PersistedState = { ...defaultPersisted(), ...initial }
  return {
    async load() {
      return structuredClone(state)
    },
    async save(next) {
      state = structuredClone(next)
    },
  }
}

const DB_NAME = 'fpga-quiz'
const STORE = 'kv'
const KEY = 'state'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function readIndexedDbState(): Promise<PersistedState | undefined> {
  if (typeof indexedDB === 'undefined') return undefined
  const db = await openDb()
  try {
    return await new Promise<PersistedState | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(KEY)
      req.onsuccess = () => resolve(req.result as PersistedState | undefined)
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

async function writeIndexedDbState(state: PersistedState): Promise<void> {
  if (typeof indexedDB === 'undefined') return
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const req = tx.objectStore(STORE).put(state, KEY)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

export function fileStorage(): QuizStorage {
  return {
    async load() {
      if (window.quizProgress) {
        const result = await window.quizProgress.load()
        if (result.exists && result.state) {
          return normalizePersisted(result.state)
        }
        const migrated = await readIndexedDbState()
        if (migrated) {
          const next = normalizePersisted(migrated)
          await window.quizProgress.save(next)
          return next
        }
        return defaultPersisted()
      }
      const fromIdb = await readIndexedDbState()
      return normalizePersisted(fromIdb)
    },
    async save(state) {
      if (window.quizProgress) {
        await window.quizProgress.save(state)
        return
      }
      await writeIndexedDbState(state)
    },
  }
}
