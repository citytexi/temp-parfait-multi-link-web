import { useRef, useState, type KeyboardEvent, type ReactElement, type Ref } from 'react'
import { useAnnounce } from './StatusRegion'
import './form.css'

type Variant = 'primary' | 'secondary' | 'ghost'

export const CONFIRM_GUARD_MS = 400

export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  name,
  variant = 'ghost',
  ref,
}: {
  label: string
  confirmLabel: string
  onConfirm(): void
  name?: string
  variant?: Variant
  ref?: Ref<HTMLButtonElement>
}): ReactElement {
  const announce = useAnnounce()
  const [armed, setArmed] = useState(false)
  const armedAt = useRef(0)
  const own = useRef<HTMLButtonElement | null>(null)

  const setRefs = (node: HTMLButtonElement | null) => {
    own.current = node
    if (typeof ref === 'function') ref(node)
    else if (ref) ref.current = node
  }

  const onClick = () => {
    if (!armed) {
      armedAt.current = Date.now()
      setArmed(true)
      announce(confirmLabel)
      // Safari does not focus a pressed button; without focus, blur could never disarm it.
      own.current?.focus()
      return
    }
    if (Date.now() - armedAt.current < CONFIRM_GUARD_MS) return
    setArmed(false)
    onConfirm()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'Escape' || !armed) return
    setArmed(false)
    announce('취소했어요')
  }

  return (
    <button
      ref={setRefs}
      type="button"
      className={`adm-button adm-button--${variant} adm-confirm`}
      aria-label={armed ? undefined : name}
      data-armed={armed ? 'true' : undefined}
      onClick={onClick}
      onBlur={() => setArmed(false)}
      onKeyDown={onKeyDown}
    >
      {armed ? confirmLabel : label}
    </button>
  )
}
