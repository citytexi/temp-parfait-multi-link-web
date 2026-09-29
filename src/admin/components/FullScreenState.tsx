import type { ReactNode } from 'react'

type FullScreenStateProps = {
  title: string
  body?: string
  actions?: ReactNode
}

export function FullScreenState({ title, body, actions }: FullScreenStateProps) {
  return (
    <div className="adm-fullscreen">
      <div className="adm-fullscreen__panel">
        <h1 className="adm-fullscreen__title">{title}</h1>
        {body && <p className="adm-fullscreen__body">{body}</p>}
        {actions && <div className="adm-fullscreen__actions">{actions}</div>}
      </div>
    </div>
  )
}
