import { app, BrowserWindow, ipcMain, Menu } from 'electron'
import { createRequire } from 'node:module'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ANALYZE_SYSTEM_PROMPT,
  GENERATE_SYSTEM_PROMPT,
  chatCompletionsUrl,
  chunkText,
  parseGeneratedQuestions,
} from './ai.mjs'

const require = createRequire(import.meta.url)
const pdfParse = require('pdf-parse/lib/pdf-parse.js')

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const DEFAULT_SETTINGS = {
  provider: 'deepseek',
  baseUrl: 'https://api.deepseek.com/v1',
  apiKey: '',
  model: 'deepseek-v4-flash',
}

const ZOOM_MIN = 0.7
const ZOOM_MAX = 2
const ZOOM_STEP = 0.1

function clampZoom(factor) {
  const n = Number(factor)
  if (!Number.isFinite(n)) return 1
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(n * 10) / 10))
}

function progressDir() {
  return path.join(app.getPath('userData'), 'user')
}

function progressFile() {
  return path.join(progressDir(), 'progress.json')
}

const DEFAULT_PROGRESS = {
  progress: {},
  newIntroducedOn: {},
  dailyNewLimit: 10,
  selectedChapterIds: [],
  customQuestions: [],
}

function normalizeProgress(raw) {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_PROGRESS }
  const daily = Number(raw.dailyNewLimit)
  return {
    progress: raw.progress && typeof raw.progress === 'object' ? raw.progress : {},
    newIntroducedOn:
      raw.newIntroducedOn && typeof raw.newIntroducedOn === 'object' ? raw.newIntroducedOn : {},
    dailyNewLimit: Number.isFinite(daily) ? Math.max(0, daily) : 10,
    selectedChapterIds: Array.isArray(raw.selectedChapterIds) ? raw.selectedChapterIds : [],
    customQuestions: Array.isArray(raw.customQuestions) ? raw.customQuestions : [],
  }
}

async function loadProgress() {
  try {
    const raw = await fs.readFile(progressFile(), 'utf8')
    return { exists: true, state: normalizeProgress(JSON.parse(raw)), path: progressFile() }
  } catch (error) {
    const missing = error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT'
    if (missing) {
      return { exists: false, state: null, path: progressFile() }
    }
    return { exists: true, state: normalizeProgress({}), path: progressFile() }
  }
}

async function saveProgress(state) {
  const next = normalizeProgress(state)
  await fs.mkdir(progressDir(), { recursive: true })
  await fs.writeFile(progressFile(), JSON.stringify(next, null, 2), 'utf8')
  return next
}

function uiSettingsFile() {
  return path.join(app.getPath('userData'), 'ui-settings.json')
}

async function loadUiSettings() {
  try {
    const raw = await fs.readFile(uiSettingsFile(), 'utf8')
    return { zoomFactor: clampZoom(JSON.parse(raw).zoomFactor) }
  } catch {
    return { zoomFactor: 1 }
  }
}

async function saveZoomFactor(factor) {
  const zoomFactor = clampZoom(factor)
  await fs.mkdir(path.dirname(uiSettingsFile()), { recursive: true })
  await fs.writeFile(uiSettingsFile(), JSON.stringify({ zoomFactor }, null, 2), 'utf8')
  return zoomFactor
}

async function applyWindowZoom(win, factor) {
  const zoomFactor = await saveZoomFactor(factor)
  win.webContents.setZoomFactor(zoomFactor)
  return zoomFactor
}

async function bumpWindowZoom(win, delta) {
  return applyWindowZoom(win, win.webContents.getZoomFactor() + delta)
}

function bindZoomKeys(win) {
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    const accel = process.platform === 'darwin' ? input.meta : input.control
    if (!accel || input.alt) return
    const key = input.key
    if (key === '=' || key === '+' || key === 'Add') {
      event.preventDefault()
      void bumpWindowZoom(win, ZOOM_STEP)
      return
    }
    if (key === '-' || key === '_' || key === 'Subtract') {
      event.preventDefault()
      void bumpWindowZoom(win, -ZOOM_STEP)
      return
    }
    if (key === '0') {
      event.preventDefault()
      void applyWindowZoom(win, 1)
    }
  })
}

function settingsFile() {
  return path.join(app.getPath('userData'), 'llm-settings.json')
}

async function loadSettings() {
  try {
    const raw = await fs.readFile(settingsFile(), 'utf8')
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

async function saveSettings(partial) {
  const current = await loadSettings()
  const next = {
    provider: String(partial.provider ?? current.provider ?? DEFAULT_SETTINGS.provider).trim() || DEFAULT_SETTINGS.provider,
    baseUrl: String(partial.baseUrl ?? current.baseUrl).trim() || DEFAULT_SETTINGS.baseUrl,
    model: String(partial.model ?? current.model).trim() || DEFAULT_SETTINGS.model,
    apiKey:
      typeof partial.apiKey === 'string' ? partial.apiKey.trim() : current.apiKey,
  }
  await fs.mkdir(path.dirname(settingsFile()), { recursive: true })
  await fs.writeFile(settingsFile(), JSON.stringify(next, null, 2), 'utf8')
  return next
}

async function chatCompletions(messages) {
  const settings = await loadSettings()
  if (!settings.apiKey) {
    throw new Error('未配置 API Key')
  }
  const response = await fetch(chatCompletionsUrl(settings.baseUrl), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: settings.model,
      messages,
      temperature: 0.3,
    }),
  })
  const body = await response.text()
  if (!response.ok) {
    throw new Error(`接口错误 ${response.status}：${body.slice(0, 400)}`)
  }
  const data = JSON.parse(body)
  const content = data?.choices?.[0]?.message?.content
  if (!content) {
    throw new Error('模型没有返回内容')
  }
  return content
}

async function extractText(fileName, buffer) {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.pdf')) {
    const parsed = await pdfParse(buffer)
    return String(parsed.text ?? '')
  }
  if (lower.endsWith('.txt') || lower.endsWith('.md') || lower.endsWith('.markdown')) {
    return buffer.toString('utf8')
  }
  throw new Error('仅支持 PDF、TXT、MD')
}

async function generateFromBuffer(name, bytes) {
  const buffer = Buffer.from(bytes)
  const text = await extractText(name, buffer)
  if (!text.trim()) {
    throw new Error('文档里没有读到文字')
  }
  const drafts = []
  for (const chunk of chunkText(text)) {
    const content = await chatCompletions([
      { role: 'system', content: GENERATE_SYSTEM_PROMPT },
      { role: 'user', content: `资料文件：${name}\n请从下面内容出题：\n\n${chunk}` },
    ])
    drafts.push(...parseGeneratedQuestions(content))
  }
  const seen = new Set()
  return drafts.filter((item) => {
    const key = `${item.chapter}::${item.title}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 820,
    minWidth: 800,
    minHeight: 600,
    title: 'FPGA 面试默写',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  void win.webContents.setVisualZoomLevelLimits(1, 1)
  bindZoomKeys(win)
  win.webContents.on('did-finish-load', () => {
    void loadUiSettings().then((ui) => {
      win.webContents.setZoomFactor(ui.zoomFactor)
    })
  })

  const devUrl = process.env.VITE_DEV_SERVER_URL
  if (devUrl) {
    void win.loadURL(devUrl)
  } else {
    void win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  ipcMain.handle('progress:load', async () => loadProgress())
  ipcMain.handle('progress:save', async (_event, state) => saveProgress(state ?? {}))
  ipcMain.handle('progress:path', async () => progressFile())
  ipcMain.handle('ui:getZoom', async () => (await loadUiSettings()).zoomFactor)
  ipcMain.handle('ui:saveZoom', async (_event, factor) => saveZoomFactor(factor))
  ipcMain.handle('ai:configured', async () => {
    const settings = await loadSettings()
    return Boolean(settings.apiKey)
  })
  ipcMain.handle('ai:getSettings', async () => {
    const settings = await loadSettings()
    return {
      provider: settings.provider ?? DEFAULT_SETTINGS.provider,
      baseUrl: settings.baseUrl,
      model: settings.model,
      apiKey: settings.apiKey ?? '',
      hasKey: Boolean(settings.apiKey),
    }
  })
  ipcMain.handle('ai:saveSettings', async (_event, partial) => {
    await saveSettings(partial ?? {})
  })
  ipcMain.handle('ai:generateFromBuffer', async (_event, payload) => {
    try {
      const drafts = await generateFromBuffer(payload.name, payload.bytes)
      return { ok: true, drafts }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  })
  ipcMain.handle('ai:analyze', async (_event, summary) => {
    try {
      const text = await chatCompletions([
        { role: 'system', content: ANALYZE_SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(summary, null, 2) },
      ])
      return { ok: true, text }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  })

  Menu.setApplicationMenu(null)
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
