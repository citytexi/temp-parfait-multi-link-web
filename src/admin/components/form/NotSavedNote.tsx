import { useEffect, useRef, type ReactElement } from 'react'
import { useAnnounce } from './StatusRegion'
import './form.css'

const NOT_SAVED = '이 브라우저에는 저장되지 않았어요. 창을 닫으면 사라져요.'

/**
 * Says that a stored value lives only in this window. Takes `persisted` from useStored.
 * Keep it mounted while `persisted` is true: it announces the sentence when that turns false.
 */
export function NotSavedNote({ persisted }: { persisted: boolean }): ReactElement | null {
  const announce = useAnnounce()
  const was = useRef(persisted)

  useEffect(() => {
    if (was.current && !persisted) announce(NOT_SAVED)
    was.current = persisted
  }, [persisted, announce])

  return persisted ? null : <p className="adm-not-saved">{NOT_SAVED}</p>
}
