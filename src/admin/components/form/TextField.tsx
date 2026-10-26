import { useId, type ComponentPropsWithoutRef, type ReactElement, type Ref } from 'react'
import './form.css'

type InputRest = Omit<
  ComponentPropsWithoutRef<'input'>,
  'value' | 'onChange' | 'id' | 'className' | 'aria-describedby' | 'aria-invalid'
>

export function TextField({
  label,
  value,
  onChange,
  help,
  error,
  ref,
  ...rest
}: InputRest & {
  label: string
  value: string
  onChange(value: string): void
  help?: string
  error?: string | null
  ref?: Ref<HTMLInputElement>
}): ReactElement {
  const id = useId()
  const helpId = `${id}-help`
  const errorId = `${id}-error`
  const describedBy = [help ? helpId : null, error ? errorId : null].filter(Boolean).join(' ')

  return (
    <div className="adm-field">
      <label className="adm-field__label" htmlFor={id}>
        {label}
      </label>
      <input
        {...rest}
        ref={ref}
        id={id}
        className="adm-field__input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={describedBy || undefined}
        aria-invalid={error ? 'true' : undefined}
      />
      {help && (
        <p id={helpId} className="adm-field__help">
          {help}
        </p>
      )}
      {error && (
        <p id={errorId} className="adm-field__error">
          {error}
        </p>
      )}
    </div>
  )
}
