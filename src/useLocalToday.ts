import { useEffect, useState } from 'react'
import { localToday, msUntilNextLocalMidnight } from './srs'

export function useLocalToday(frozen?: string): string {
  const [today, setToday] = useState(() => frozen ?? localToday())

  useEffect(() => {
    if (frozen) {
      setToday(frozen)
      return
    }
    const sync = () => setToday(localToday())
    sync()
    let timer = window.setTimeout(function tick() {
      sync()
      timer = window.setTimeout(tick, msUntilNextLocalMidnight())
    }, msUntilNextLocalMidnight())
    const onResume = () => sync()
    document.addEventListener('visibilitychange', onResume)
    window.addEventListener('focus', onResume)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onResume)
      window.removeEventListener('focus', onResume)
    }
  }, [frozen])

  return frozen ?? today
}
