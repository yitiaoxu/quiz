const ZOOM_MIN = 0.7
const ZOOM_MAX = 2
const ZOOM_STEP = 0.1

export function clampZoomFactor(factor: number) {
  if (!Number.isFinite(factor)) return 1
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(factor * 10) / 10))
}

export function installQuizZoom() {
  const api = window.quizZoom
  if (!api) return

  void api.restore()

  const onWheel = (event: WheelEvent) => {
    if (!(event.ctrlKey || event.metaKey)) return
    event.preventDefault()
    void api.bump(event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP)
  }

  window.addEventListener('wheel', onWheel, { passive: false })
}
