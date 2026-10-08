import { useEffect, useId, useRef, useState, type ReactElement } from 'react'
import './search-field.css'

export const SEARCH_COMMIT_DELAY_MS = 300

type SearchFieldProps = {
  label: string
  placeholder?: string
  /** Current value of the URL param. */
  value: string | null
  /** An empty box is passed as null. */
  onCommit(value: string | null): void
}

export function SearchField({ label, placeholder, value, onCommit }: SearchFieldProps): ReactElement {
  const id = useId()
  const [text, setText] = useState(value ?? '')
  const lastCommitted = useRef<string | null>(value)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const composing = useRef(false)
  const onCommitRef = useRef(onCommit)

  useEffect(() => {
    onCommitRef.current = onCommit
  })

  // Take a value that changed outside (back navigation); an echo of our own commit changes nothing.
  useEffect(() => {
    if (value === lastCommitted.current) return
    lastCommitted.current = value
    clearTimeout(timer.current)
    composing.current = false
    setText(value ?? '')
  }, [value])

  useEffect(() => () => clearTimeout(timer.current), [])

  const commit = (raw: string) => {
    clearTimeout(timer.current)
    const next = raw === '' ? null : raw
    if (next === lastCommitted.current) return
    lastCommitted.current = next
    onCommitRef.current(next)
  }

  const schedule = (raw: string) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => commit(raw), SEARCH_COMMIT_DELAY_MS)
  }

  return (
    <label className="adm-devtools-search" htmlFor={id}>
      <span className="adm-devtools-search__label">{label}</span>
      <input
        id={id}
        className="adm-devtools-search__input"
        type="search"
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value)
          if (!composing.current) schedule(e.target.value)
        }}
        onCompositionStart={() => {
          composing.current = true
          clearTimeout(timer.current)
        }}
        onCompositionEnd={(e) => {
          composing.current = false
          schedule(e.currentTarget.value)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !composing.current && !e.nativeEvent.isComposing) {
            commit(e.currentTarget.value)
          }
        }}
        onBlur={(e) => {
          if (!composing.current) commit(e.currentTarget.value)
        }}
      />
    </label>
  )
}
