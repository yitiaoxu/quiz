const { contextBridge, ipcRenderer, webFrame } = require('electron')

function clampZoom(factor) {
  const n = Number(factor)
  if (!Number.isFinite(n)) return 1
  return Math.min(2, Math.max(0.7, Math.round(n * 10) / 10))
}

async function applyZoom(factor) {
  const next = clampZoom(factor)
  webFrame.setZoomFactor(next)
  await ipcRenderer.invoke('ui:saveZoom', next)
  return next
}

contextBridge.exposeInMainWorld('quizZoom', {
  restore: async () => {
    const factor = clampZoom(await ipcRenderer.invoke('ui:getZoom'))
    webFrame.setZoomFactor(factor)
    return factor
  },
  bump: async (delta) => applyZoom(webFrame.getZoomFactor() + Number(delta)),
  reset: async () => applyZoom(1),
  get: () => webFrame.getZoomFactor(),
})

contextBridge.exposeInMainWorld('quizProgress', {
  load: () => ipcRenderer.invoke('progress:load'),
  save: (state) => ipcRenderer.invoke('progress:save', state),
  path: () => ipcRenderer.invoke('progress:path'),
})

contextBridge.exposeInMainWorld('quizAi', {
  configured: () => ipcRenderer.invoke('ai:configured'),
  getSettings: () => ipcRenderer.invoke('ai:getSettings'),
  saveSettings: (partial) => ipcRenderer.invoke('ai:saveSettings', partial),
  generateFromBuffer: (payload) => ipcRenderer.invoke('ai:generateFromBuffer', payload),
  analyze: (summary) => ipcRenderer.invoke('ai:analyze', summary),
})
