import { createContext, useCallback, useContext, useRef, useState, type ReactElement, type ReactNode } from 'react'
import './form.css'

type Announce = (message: string) => void

const noop: Announce = () => {}
const AnnounceContext = createContext<Announce>(noop)

// A no-break space (NBSP), written as an escape so the character is visible in the source.
const NBSP = '\u00a0'

/** Wraps a page's content and adds one permanently mounted, visually hidden status region after it. */
export function StatusRegion({ children }: { children: ReactNode }): ReactElement {
  const [note, setNote] = useState({ id: 0, text: '' })
  const last = useRef('')

  const announce = useCallback<Announce>((message) => {
    // Screen readers skip text that did not change, so alternate a trailing NBSP on repeats.
    const text = message === last.current ? message + NBSP : message
    last.current = text
    setNote((prev) => ({ id: prev.id + 1, text }))
  }, [])

  return (
    <AnnounceContext.Provider value={announce}>
      {children}
      <div role="status" className="adm-status-region adm-sr-only">
        {note.id > 0 && <span key={note.id}>{note.text}</span>}
      </div>
    </AnnounceContext.Provider>
  )
}

/** Returns a stable function that writes to the nearest StatusRegion; a no-op outside one. */
export function useAnnounce(): Announce {
  return useContext(AnnounceContext)
}
