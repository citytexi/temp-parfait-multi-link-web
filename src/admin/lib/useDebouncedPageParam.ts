import { useCallback, useEffect, useRef, useState } from 'react'
import { useNav, usePageParam } from '../menu/NavContext'

export const PARAM_COMMIT_DELAY_MS = 300

/**
 * A typed field backed by a page param: [field value, set field value, write to the URL now].
 * The URL is written after a pause (not per keystroke) and never during IME composition.
 * An outside URL change (back button, other code) replaces the field and drops the pending
 * write; leaving the page or changing the menu drops it too. Both functions are stable.
 */
export function useDebouncedPageParam(
  key: string,
  delayMs: number = PARAM_COMMIT_DELAY_MS,
): [string, (value: string) => void, () => void] {
  const [urlValue, setUrlValue] = usePageParam(key)
  const { menu } = useNav()
  const urlStr = urlValue ?? ''

  const [value, setValue] = useState(urlStr)
  const valueRef = useRef(urlStr)
  // The URL value this hook has written or accepted last.
  const knownRef = useRef(urlStr)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const composingRef = useRef(false)
  const setUrlRef = useRef(setUrlValue)
  setUrlRef.current = setUrlValue
  const delayRef = useRef(delayMs)
  delayRef.current = delayMs
  const menuRef = useRef(menu)

  const clearTimer = useCallback(() => {
    clearTimeout(timerRef.current)
    timerRef.current = undefined
  }, [])

  const write = useCallback(() => {
    clearTimer()
    const v = valueRef.current
    if (v === knownRef.current) return
    knownRef.current = v
    setUrlRef.current(v === '' ? null : v)
  }, [clearTimer])

  const schedule = useCallback(() => {
    clearTimer()
    timerRef.current = setTimeout(() => {
      timerRef.current = undefined
      if (!composingRef.current) write()
    }, delayRef.current)
  }, [clearTimer, write])

  const set = useCallback(
    (next: string) => {
      valueRef.current = next
      setValue(next)
      if (!composingRef.current) schedule()
    },
    [schedule],
  )

  useEffect(() => {
    const onStart = () => {
      composingRef.current = true
      clearTimer()
    }
    const onEnd = () => {
      composingRef.current = false
      schedule()
    }
    document.addEventListener('compositionstart', onStart)
    document.addEventListener('compositionend', onEnd)
    return () => {
      document.removeEventListener('compositionstart', onStart)
      document.removeEventListener('compositionend', onEnd)
      clearTimer()
    }
  }, [clearTimer, schedule])

  // The URL changed to something this hook did not write: take it.
  useEffect(() => {
    if (urlStr === knownRef.current) return
    knownRef.current = urlStr
    valueRef.current = urlStr
    clearTimer()
    setValue(urlStr)
  }, [urlStr, clearTimer])

  // A menu change clears page params; the field follows even if this key had none.
  useEffect(() => {
    if (menuRef.current === menu) return
    menuRef.current = menu
    knownRef.current = urlStr
    valueRef.current = urlStr
    clearTimer()
    setValue(urlStr)
  }, [menu, urlStr, clearTimer])

  return [value, set, write]
}
