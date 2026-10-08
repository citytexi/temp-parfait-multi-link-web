import { useId, type ReactElement } from 'react'
import './form.css'

export function CheckboxField({
  label,
  checked,
  onChange,
  help,
}: {
  label: string
  checked: boolean
  onChange(checked: boolean): void
  help?: string
}): ReactElement {
  const helpId = `${useId()}-help`

  return (
    <div className="adm-field adm-field--checkbox">
      <label className="adm-field__label">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-describedby={help ? helpId : undefined}
        />
        <span>{label}</span>
      </label>
      {help && (
        <p id={helpId} className="adm-field__help">
          {help}
        </p>
      )}
    </div>
  )
}
