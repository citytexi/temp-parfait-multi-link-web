import type { ReactElement } from 'react'
import './event-name.css'

/** An event in a table cell: its label over the raw name, or the name alone when it has no label. */
export function EventName({ name, label }: { name: string; label: string }): ReactElement {
  return (
    <span className="adm-devtools-event-name">
      {label !== name ? (
        <>
          <span className="adm-devtools-event-name__label">{label}</span>
          <span className="adm-devtools-event-name__raw">{name}</span>
        </>
      ) : (
        <span className="adm-devtools-event-name__label">{name}</span>
      )}
    </span>
  )
}
