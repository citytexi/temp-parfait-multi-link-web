import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import { useAnnounce } from './StatusRegion'
import './form.css'

type Variant = 'primary' | 'secondary' | 'ghost'

export const COPIED_MS = 2000

const COPIED = '복사했어요'
const FAILED = '복사하지 못했어요. 아래 내용을 직접 복사해 주세요.'

export function CopyButton({
  label,
  text,
  name,
  variant = 'secondary',
  onCopy,
}: {
  label: string
  text: string | (() => string)
  name?: string
  variant?: Variant
  onCopy?(): void
}): ReactElement {
  const announce = useAnnounce()
  const [copied, setCopied] = useState(false)
  // The text shown in the fallback box; null while no copy has failed.
  const [fallback, setFallback] = useState<string | null>(null)
  const [failures, setFailures] = useState(0)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const box = useRef<HTMLTextAreaElement>(null)

  useEffect(() => () => clearTimeout(timer.current), [])

  useEffect(() => {
    if (failures > 0) box.current?.select()
  }, [failures])

  const onClick = useCallback(async () => {
    const value = typeof text === 'function' ? text() : text
    onCopy?.()
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      setCopied(false)
      clearTimeout(timer.current)
      setFallback(value)
      setFailures((n) => n + 1)
      announce(FAILED)
      return
    }
    setFallback(null)
    setCopied(true)
    announce(COPIED)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), COPIED_MS)
  }, [text, onCopy, announce])

  return (
    <div className="adm-copy-wrap">
      <button
        type="button"
        className={`adm-button adm-button--${variant} adm-copy`}
        aria-label={name}
        onClick={onClick}
      >
        {copied ? COPIED : label}
      </button>
      {fallback !== null && (
        <>
          <p className="adm-copy__note">{FAILED}</p>
          <textarea
            ref={box}
            className="adm-copy__box"
            aria-label="복사할 내용"
            readOnly
            rows={3}
            value={fallback}
          />
        </>
      )}
    </div>
  )
}
