import { useId, type ReactElement, type Ref } from 'react'
import './form.css'

export function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  help,
  ref,
}: {
  label: string
  value: string
  onChange(value: string): void
  options: readonly { value: string; label: string }[]
  placeholder?: string
  help?: string
  ref?: Ref<HTMLSelectElement>
}): ReactElement {
  const id = useId()
  const helpId = `${id}-help`

  return (
    <div className="adm-field">
      <label className="adm-field__label" htmlFor={id}>
        {label}
      </label>
      <select
        ref={ref}
        id={id}
        className="adm-field__input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={help ? helpId : undefined}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {help && (
        <p id={helpId} className="adm-field__help">
          {help}
        </p>
      )}
    </div>
  )
}
