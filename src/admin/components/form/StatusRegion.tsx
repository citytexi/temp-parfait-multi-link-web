import { createContext, useCallback, useContext, useRef, useState, type ReactElement, type ReactNode } from 'react'
import './form.css'

type Announce = (message: string) => void

const noop: Announce = () => {}
const AnnounceContext = createContext<Announce>(noop)

// A no-break space (NBSP), written as an escape so the character is visible in the source.
const NBSP = '\u00a0'

/**
 * Announcements this close together stay in the region side by side. One action can announce twice
 * ("추가했어요" and then that it was not saved); the second must not replace the first before it is read.
 */
export const ANNOUNCE_TOGETHER_MS = 1000

type Note = { id: number; text: string; at: number }

/** Wraps a page's content and adds one permanently mounted, visually hidden status region after it. */
export function StatusRegion({ children }: { children: ReactNode }): ReactElement {
  const [notes, setNotes] = useState<readonly Note[]>([])
  const last = useRef({ id: 0, text: '' })

  const announce = useCallback<Announce>((message) => {
    // Screen readers skip text that did not change, so alternate a trailing NBSP on repeats.
    const text = message === last.current.text ? message + NBSP : message
    const id = last.current.id + 1
    last.current = { id, text }
    const at = Date.now()
    setNotes((prev) => [...prev.filter((n) => at - n.at < ANNOUNCE_TOGETHER_MS), { id, text, at }])
  }, [])

  return (
    <AnnounceContext.Provider value={announce}>
      {children}
      <div role="status" className="adm-status-region adm-sr-only">
        {notes.map((n) => (
          <span key={n.id}>{n.text}</span>
        ))}
      </div>
    </AnnounceContext.Provider>
  )
}

/** Returns a stable function that writes to the nearest StatusRegion; a no-op outside one. */
export function useAnnounce(): Announce {
  return useContext(AnnounceContext)
}
