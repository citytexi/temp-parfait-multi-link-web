import { useEffect, useId, useState } from 'react'

export function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const tipId = useId()

  // Esc dismisses the tip wherever focus is, including when it was opened by hover (WCAG 1.4.13).
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <span className="adm-infotip" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        className="adm-infotip__button"
        aria-label="설명 보기"
        aria-expanded={open}
        aria-describedby={open ? tipId : undefined}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        // Hover and focus already open it on most devices; click/tap only ever opens so
        // a tap (which also focuses) never cancels itself out. Esc or blur closes.
        onClick={() => setOpen(true)}
      >
        <svg className="adm-infotip__icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 7v4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="8" cy="4.75" r="1" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <span id={tipId} role="tooltip" className="adm-infotip__bubble">
          {text}
        </span>
      )}
    </span>
  )
}
