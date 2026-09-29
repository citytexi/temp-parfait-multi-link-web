import type { ReactNode } from 'react'

type FullScreenStateProps = {
  title: string
  body?: string
  /** Small secondary text under the body, e.g. the raw API error for diagnosis. */
  detail?: string | null
  actions?: ReactNode
}

export function FullScreenState({ title, body, detail, actions }: FullScreenStateProps) {
  return (
    <div className="adm-fullscreen">
      <div className="adm-fullscreen__panel">
        <h1 className="adm-fullscreen__title">{title}</h1>
        {body && <p className="adm-fullscreen__body">{body}</p>}
        {detail && <p className="adm-fullscreen__detail">{detail}</p>}
        {actions && <div className="adm-fullscreen__actions">{actions}</div>}
      </div>
    </div>
  )
}
